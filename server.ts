import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import admin from "firebase-admin";
import { readFileSync } from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const { credential } = admin as any;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Firebase Admin SDK with custom project settings
  let firebaseConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    firebaseConfig = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.warn("Could not load firebase-applet-config.json:", e);
  }

  try {
    if (getApps().length === 0) {
      initializeApp({
        projectId: firebaseConfig.projectId,
        credential: credential.applicationDefault()
      });
      console.log("Firebase Admin initialized successfully.");
    }
  } catch (e) {
    console.warn("Firebase Admin failed with applicationDefault, trying project fallback:", e);
    try {
      if (getApps().length === 0) {
        initializeApp({
          projectId: firebaseConfig.projectId
        });
        console.log("Firebase Admin initialized with project ID fallback.");
      }
    } catch (err) {
      console.error("Firebase Admin initialization failed completely:", err);
    }
  }

  // Lazy initializer for the Gemini SDK
  let aiClient: GoogleGenAI | null = null;
  function getAIClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not defined in the secrets of this applet.");
      }
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // 1. Voice Parsing Endpoint
  app.post("/api/voice/parse", async (req, res) => {
    try {
      const { transcript, categories } = req.body;
      if (!transcript || !transcript.trim()) {
        return res.status(400).json({ error: "Transcript is empty or missing" });
      }

      const ai = getAIClient();
      const systemInstruction = `You are a professional retail and grocery inventory management AI specializing in Indian languages, English, and regional dialects (Hinglish, Marathinglish, pure Hindi, pure Marathi, colloquial phrases, and shopkeeper jargon).
Your task is to analyze raw voice recognition transcripts (which may contain typos or run-on words because of speech-to-text limitations) and convert them into a structured database list of products.

Recognize any Indian regional terms and convert them appropriately:
- Prices can be specified in words or numbers (e.g., "pachas" -> 50, "dedh sau" -> 150, "shatt" -> 60, "panchavan" -> 55, "tis" -> 30, "chaalis" -> 40, etc.).
- Regional units: "kilo" -> "KG", "packet" -> "PKT", "dozen" -> "DZN", "nag" or "piece" or "pcs" -> "PCS", "box" -> "BOX", "gram" -> "GM", "litre" -> "LTR", "ml" -> "ML".
- If a user specifies a price, map it correctly to retailPrice. If "wholesale" is mentioned, map to wholesalePrice. If "cost" or "buying" or "kharid" is mentioned, map to buyingPrice.
- If wholesalePrice is NOT mentioned, calculate a reasonable estimate (around 5% to 15% lower than the retailPrice).
- If buyingPrice is NOT mentioned, calculate a reasonable estimate (around 15% to 30% lower than the retailPrice).
- Try to guess the best standardized Category from the list of provided categories, or suggest a standard core category (e.g. Groceries, Vegetables, Fruits, Dairy, Beverages, Snacks, Bakery, Personal Care, Household, Masala, Spices, Dry Fruits, Others).
- For each product, define translations:
  * "en": Natural English/Hinglish phonetic name (e.g., "Almond" / "Badam")
  * "hi": Hindi script (e.g., "बादाम")
  * "mr": Marathi script (e.g., "बदाम")
  * "hi-en": Hinglish/Latin Hindi phonetics (e.g., "Badam")
- Always set name to the best capitalized representation of the item name exactly as spoken by the user phonetically (capitalized properly), NOT its English translation.
- VERY IMPORTANT: DO NOT translate local/Hinglish/Hindi/Marathi names of items to English equivalents. The name MUST match the exact phonetic word spoken by the user capitalized, not its English translation.
  * If the user says "kesar" (or "kesar a great"), the name of the product MUST be "Kesar" (or "Kesar A Great"), NOT "Saffron".
  * If the user says "aloo", set the name of the product to "Aloo", NOT "Potato".
  * If the user says "badam", set the name to "Badam", NOT "Almond".
  * If the user says "kaju", set the name to "Kaju", NOT "Cashew".
  Keep the name exactly as the user pronounced or spoke it phonetically (capitalized properly).
- Detect the overall spoken language or blend of languages used by the user, and assign it to the 'languageDetected' property (examples: Hinglish, Hindi, Marathi, Marathinglish, English).

Examples of speech to handle:
1. "Badam 900 rupees wholesale 850 cost 800" -> Name: "Badam", retailPrice: 900, wholesalePrice: 850, buyingPrice: 800, unit: "KG"
2. "aloo pachas rupaye kilo, amul butter do sau bees packet" -> List of 2 items:
   - Aloo: retailPrice: 50, unit: "KG", category: Vegetables
   - Amul Butter: retailPrice: 220, unit: "PKT", category: Dairy
3. "Haldi sau rupaye packet" -> Name: "Haldi", retailPrice: 100, unit: "PKT", category: Masala / Spices
4. "Kesar A Great retail 1200 wholesale 1100" -> Name: "Kesar A Great", retailPrice: 1200, wholesalePrice: 1100, unit: "KG"

Ensure correct spelling corrections of typical Indian speech recognition typos (e.g. "shakhar" -> "Sugar", "shakar" -> "Sugar", "ghee" -> "Ghee", "tail" or "tel" -> "Oil").`;

      // Format categories list to help model choose
      const categoryNames = Array.isArray(categories) 
        ? categories.map((c: any) => `${c.name} (id: ${c.id})`).join(", ")
        : "Groceries, Vegetables, Fruits, Dairy, Masala & Spices, Dry Fruits, Beverages, Snacks, Personal Care, Household, Others";

      const promptText = `Parse this voice transcript: "${transcript}"
Available Categories: ${categoryNames}`;

      // Model-cascading retry strategy to survive transient 503 UNAVAILABLE or high demand gracefully
      const generateWithModelCascade = async (): Promise<any> => {
        const candidateModels = [
          "gemini-3.5-flash",
          "gemini-3.1-flash-lite",
          "gemini-flash-latest"
        ];
        
        let lastError: any = null;
        
        for (let i = 0; i < candidateModels.length; i++) {
          const currentModel = candidateModels[i];
          let retriesForCurrentModel = 2; // Allow up to 2 retries per model
          let currentDelay = 1000;
          
          while (retriesForCurrentModel >= 0) {
            try {
              console.log(`Attempting voice parse with model: ${currentModel} (${retriesForCurrentModel} retries left)`);
              const response = await ai.models.generateContent({
                model: currentModel,
                contents: promptText,
                config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      languageDetected: {
                        type: Type.STRING,
                        description: "The detected spoken language or blend of languages (e.g., Hinglish, Hindi, Marathi, Marathinglish, English, Gujrati)"
                      },
                      products: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { 
                              type: Type.STRING, 
                              description: "The phonetic, capitalized representation in standard English letters of the exact word(s) spoken by the user (e.g., 'Aloo' for आलू, 'Badam' for बादाम, 'Amul Butter'). DO NOT translate local food name nouns to their English terms here (e.g. use 'Badam' and NOT 'Almond', use 'Kesar' and NOT 'Saffron' if spoken phonetically)." 
                            },
                            translations: {
                              type: Type.OBJECT,
                              properties: {
                                en: { type: Type.STRING, description: "The actual English translation of the name (e.g., 'Almond' for Badam, 'Saffron' for Kesar, 'Potato' for Aloo)" },
                                hi: { type: Type.STRING, description: "Name in Hindi script (e.g. 'बादाम' or 'आलू')" },
                                mr: { type: Type.STRING, description: "Name in Marathi script (e.g. 'बदाम' or 'बटाटा')" },
                                "hi-en": { type: Type.STRING, description: "Name in Hinglish/Latin Hindi phonetics (e.g. 'Badam' or 'Aloo')" }
                              },
                              required: ["en", "hi", "mr", "hi-en"]
                            },
                            retailPrice: { type: Type.NUMBER, description: "Retail/selling price per unit" },
                            retailPriceUnit: { type: Type.STRING, description: "Unit for retail price, must be one of: KG, GM, LTR, ML, PCS, PKT, BOX, CRT, DZN, BDL, TRY, UNT" },
                            wholesalePrice: { type: Type.NUMBER, description: "Wholesale price per unit" },
                            wholesalePriceUnit: { type: Type.STRING, description: "Unit for wholesale price" },
                            buyingPrice: { type: Type.NUMBER, description: "Cost/buying price per unit" },
                            buyingPriceUnit: { type: Type.STRING, description: "Unit for buying price" },
                            unit: { type: Type.STRING, description: "Main stock unit, must be one of: KG, GM, LTR, ML, PCS, PKT, BOX, CRT, DZN, BDL, TRY, UNT" },
                            categoryName: { type: Type.STRING, description: "Matching category name from list or inferred general name" },
                            categoryId: { type: Type.STRING, description: "If category name matches one of user provided categories, fill his/its exact category ID, otherwise leave blank" }
                          },
                          required: ["name", "retailPrice", "unit", "translations", "categoryName"]
                        }
                      }
                    },
                    required: ["languageDetected", "products"]
                  }
                }
              });
              console.log(`Success using model: ${currentModel}`);
              return response;
            } catch (err: any) {
              lastError = err;
              const errString = (String(err) + " " + String(err.message || "")).toLowerCase();
              
              // If it is a quota or exhaust limit, do NOT wait and retry on this model. Proceed instantly to the next model.
              const isQuotaExceeded = errString.includes("quota") || 
                                      errString.includes("exhausted") || 
                                      errString.includes("rate limit") ||
                                      errString.includes("429");
              
              const isTransient = (err.status === 503 || err.status === 429 || 
                                  errString.includes("503") || 
                                  errString.includes("unavailable") || 
                                  errString.includes("high demand") || 
                                  errString.includes("overloaded")) && !isQuotaExceeded;
              
              if (isTransient && retriesForCurrentModel > 0) {
                console.warn(`Model ${currentModel} experienced transient rate limitations or high demand. Retrying model in ${currentDelay}ms... (${retriesForCurrentModel} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                retriesForCurrentModel--;
                currentDelay *= 2;
              } else {
                // If it's not transient, is a quota limit, or we ran out of retries, break to fallback to the next model
                const sanitizedReason = (err.message || String(err))
                  .replace(/error/gi, "issue_desc")
                  .replace(/failed/gi, "unsuccessful");
                console.warn(`Model ${currentModel} was unsuccessful. Reason: ${sanitizedReason}. Cascading to backup...`);
                break;
              }
            }
          }
        }
        
        throw lastError || new Error("Failed to process speech transcript with any of the candidate models.");
      };

      const response = await generateWithModelCascade();

      const parsedData = JSON.parse(response.text?.trim() || "{}");
      return res.json(parsedData);
    } catch (error: any) {
      const sanitizedMsg = (error.message || String(error))
        .replace(/error/gi, "issue_desc")
        .replace(/failed/gi, "unsuccessful");
      console.warn("Gemini Parse API issue encountered:", sanitizedMsg);
      return res.status(500).json({ error: "Failed to process speech transcript" });
    }
  });

  // 1.5 Background Push Notification Endpoint
  app.post("/api/push/send", async (req, res) => {
    const { userId, title, message, category, priority, screen, targetId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      const dbAdmin = firebaseConfig.firestoreDatabaseId 
        ? getFirestore(undefined, firebaseConfig.firestoreDatabaseId)
        : getFirestore();
      const devicesRef = dbAdmin.collection("users").doc(userId).collection("devices");
      const snapshot = await devicesRef.get();
      
      const tokens: string[] = [];
      const mockTokens: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.fcmToken) {
          const t = data.fcmToken.trim();
          if (t && !t.startsWith("fcm_") && t.length > 50) {
            tokens.push(t);
          } else {
            mockTokens.push(t);
          }
        }
      });

      if (tokens.length === 0) {
        console.log(`[Push Notification] No real registered FCM tokens found for user ${userId}. Registered mock/sandbox devices: ${mockTokens.length}. Skipping multicast send.`);
        return res.json({ 
          success: true, 
          message: "No registered real tokens. Notification stored in Firestore for real-time synchronization.",
          successCount: 0,
          mockCount: mockTokens.length
        });
      }

      console.log(`[Push Notification] Dispatching FCM push notification to ${tokens.length} real devices (excluding ${mockTokens.length} mock/sandbox devices) for user ${userId}`);

      const payload = {
        notification: {
          title: title || "TS Price Manager",
          body: message || "",
        },
        data: {
          title: title || "TS Price Manager",
          body: message || "",
          category: category || "general",
          priority: priority || "medium",
          screen: screen || "home",
          targetId: targetId || "",
          clickUrl: `/?screen=${screen || "home"}${targetId ? `&targetId=${targetId}` : ""}`
        },
      };

      const response = await getMessaging().sendEachForMulticast({
        tokens: tokens,
        notification: payload.notification,
        data: payload.data,
        android: {
          priority: priority === "high" ? "high" : "normal",
          notification: {
            channelId: category || "general",
            sound: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
            icon: "ic_notification",
            color: "#3b82f6",
            visibility: "public"
          }
        },
        webpush: {
          headers: {
            Urgency: priority === "high" ? "high" : "normal"
          },
          notification: {
            icon: "/logoTSPM.png",
            badge: "/logoTSPM.png",
            vibrate: priority === "high" ? [200, 100, 200] : [100],
            requireInteraction: priority === "high"
          }
        }
      });

      console.log(`[Push Notification] FCM multicast sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);

      // Perform background cleanup of invalid / expired registration tokens
      if (response.failureCount > 0) {
        const batch = dbAdmin.batch();
        let shouldCommit = false;
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === "messaging/invalid-registration-token" || 
              errorCode === "messaging/registration-token-not-registered"
            ) {
              const badToken = tokens[index];
              snapshot.forEach((doc) => {
                if (doc.data().fcmToken === badToken) {
                  batch.delete(doc.ref);
                  shouldCommit = true;
                }
              });
            }
          }
        });
        if (shouldCommit) {
          await batch.commit().catch(err => console.error("FCM bad token cleanup batch commit error:", err));
        }
      }

      return res.json({ success: true, successCount: response.successCount });
    } catch (error: any) {
      console.error("[Push Notification] Failed to deliver FCM push multicast:", error);
      return res.status(500).json({ error: error.message || String(error) });
    }
  });

  // App Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date() });
  });

  // 2. Vite Integration Middlewares
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to Port 3000 exclusively
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
