import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. AI features will be disabled.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface AISmartEntryResult {
  name: string;
  category?: string;
  retailPrice?: number;
  wholesalePrice?: number;
  buyingPrice?: number;
  unit?: string;
  notes?: string;
}

/**
 * Clean and parse JSON from AI response, handling potential markdown blocks.
 */
function cleanAndParseJson(text: string): any {
  try {
    // Remove potential markdown code blocks
    let cleaned = text.replace(/```json\n?|```/g, "").trim();
    // Sometimes the model might return text before or after the JSON block
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Clean/Parse Error:", e, "Original text:", text);
    throw e;
  }
}

/**
 * Translates an item name into multiple languages.
 */
export async function translateItemName(name: string): Promise<any> {
  try {
    const ai = getAI();
    if (!ai || !ai.models) throw new Error("AI not initialized");
    const response = await (ai.models as any).generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the product name "${name}" into Hindi, Marathi, and Hinglish.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            en: { type: Type.STRING },
            hi: { type: Type.STRING },
            mr: { type: Type.STRING },
            'hi-en': { type: Type.STRING },
          },
          required: ["en", "hi", "mr", "hi-en"]
        },
        systemInstruction: "You are a multilingual translator for an Indian inventory app. Return ONLY JSON.",
      },
    });
    const result = cleanAndParseJson(response.text || "{}");
    return {
      en: result.en || name,
      hi: result.hi || '',
      mr: result.mr || '',
      'hi-en': result['hi-en'] || ''
    };
  } catch (error) {
    console.error("Translation Error:", error);
    return { en: name, hi: '', mr: '', 'hi-en': '' };
  }
}

/**
 * Provides a price advisory based on margins and market context.
 */
export async function generatePriceAdvisory(item: any): Promise<string> {
  try {
    const ai = getAI();
    if (!ai || !ai.models) throw new Error("AI not initialized");
    const response = await (ai.models as any).generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze pricing:
      Name: ${item.name}
      Buy: ${item.buyingPrice}
      Wholesale: ${item.wholesalePrice}
      Retail: ${item.retailPrice}`,
      config: {
        systemInstruction: "Provide a quick, 2-sentence pricing advice. Is the margin healthy? Any trends? Be professional and direct.",
      },
    });
    return response.text || "No AI feedback currently.";
  } catch (error) {
    return "Analysis unavailable.";
  }
}

/**
 * Categorizes a note into business categories or priorities.
 */
export async function getSmartNoteCategorization(title: string, description: string): Promise<string> {
  try {
    const ai = getAI();
    if (!ai || !ai.models) throw new Error("AI not initialized");
    const response = await (ai.models as any).generateContent({
      model: "gemini-3-flash-preview",
      contents: `Categorize this note: 
      Title: ${title}
      Description: ${description}`,
      config: {
        systemInstruction: "Categorize this note into ONE of: Urgent, Important, Medium, or Normal. Return ONLY the category name.",
      },
    });
    return response.text.trim() || "Normal";
  } catch (error) {
    return "Normal";
  }
}

/**
 * Analyzes business notes to provide insights.
 */
export async function analyzeNotes(notes: string[]): Promise<string> {
  try {
    const ai = getAI();
    if (!ai || !ai.models) throw new Error("AI not initialized");
    const response = await (ai.models as any).generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze these business notes and provide a summary of key actions or trends:\n${notes.join("\n---\n")}`,
      config: {
        systemInstruction: "You are a business consultant. Summarize the notes into a concise, bulleted list of 'Action Items' and 'General Insights'. Focus on inventory and price management topics.",
      },
    });
    return response.text || "No insights found in notes.";
  } catch (error) {
    return "AI Note Analysis failed.";
  }
}

/**
 * Parses a natural language description of an item into structured data, optimized for Dry Fruits & Masala stores.
 */
export async function parseItemDescription(input: string): Promise<AISmartEntryResult | null> {
  try {
    const ai = getAI();
    if (!ai || !ai.models) throw new Error("AI not initialized");
    const response = await (ai.models as any).generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract item details from: "${input}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            retailPrice: { type: Type.NUMBER },
            wholesalePrice: { type: Type.NUMBER },
            buyingPrice: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ["name"]
        },
        systemInstruction: `Extract product details for a Dry Fruits & Masala Store. 
        Example inputs: 
        - "Badam quality A, 1kg retail 900, wholesale 850, buy 800"
        - "Jeera powder 500g, selling 200, bulk 180, cost 150"
        Guess the unit (KG, G, PCS, PKT) if possible. Return ONLY JSON.`,
      },
    });
    return cleanAndParseJson(response.text || "null");
  } catch (error) {
    console.error("AI Parse Error:", error);
    return null;
  }
}

/**
 * Analyzes the entire inventory to provide a business summary.
 */
export async function analyzeInventory(items: any[]): Promise<string> {
  try {
    const ai = getAI();
    if (!ai || !ai.models) throw new Error("AI not initialized");
    const summary = items.map(i => `${i.name}: Buy ₹${i.buyingPrice}, Sell ₹${i.retailPrice}`).join(', ');
    const response = await (ai.models as any).generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this inventory: ${summary.slice(0, 2000)}`,
      config: {
        systemInstruction: "You are a business manager. Give a single, powerful sentence summary of the inventory health and pricing strategy.",
      },
    });
    return response.text.trim() || "Inventory balance within operational parameters.";
  } catch (error) {
    return "Intelligence matrix offline.";
  }
}

/**
 * Advanced Chatbot logic: Processes natural language commands into application actions.
 */
export async function processChatCommand(command: string, history: any[]): Promise<any> {
  try {
    const ai = getAI();
    if (!ai || !ai.models) throw new Error("AI not initialized");
    const response = await (ai.models as any).generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: command }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: "Your conversational response in the user's language (Hindi, Hinglish, Marathi, or English)." },
            action: { 
              type: Type.STRING, 
              enum: ["ADD_ITEM", "EDIT_ITEM", "DELETE_ITEM", "SEARCH", "ADD_NOTE", "EXPORT", "HIDE_BUYING", "SHOW_BUYING", "NONE"],
              description: "The intended app action." 
            },
            data: { 
              type: Type.OBJECT, 
              description: "Extracted data for the action." ,
              properties: {
                name: { type: Type.STRING },
                retailPrice: { type: Type.NUMBER },
                wholesalePrice: { type: Type.NUMBER },
                buyingPrice: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                id: { type: Type.STRING, description: "ID for edit/delete actions" },
                query: { type: Type.STRING, description: "Search query" },
                noteTitle: { type: Type.STRING },
                noteDesc: { type: Type.STRING }
              }
            }
          },
          required: ["reply", "action"]
        },
        systemInstruction: `You are 'TS Assistant', a premium AI for 'TS Price Manager'. 
        You understand English, Hindi, Marathi, and Hinglish.
        
        SUPPORTED ACTIONS:
        - ADD_ITEM: format "Name -> Unit -> Retail -> Wholesale -> Buy" or natural language.
        - EDIT_ITEM: change price or unit of existing item.
        - DELETE_ITEM: remove an item.
        - SEARCH: find an item.
        - ADD_NOTE: add business notes/reminders.
        - EXPORT: export database to excel/json.
        - HIDE_BUYING / SHOW_BUYING: toggle visibility of cost prices.
        
        For ADD_ITEM, if information is missing (like prices), ask for them politely.
        If user says "Badam -> kg -> 950 -> 900 -> 820", this is an ADD_ITEM action.
        
        Always be professional, concise, and helpful. Return ONLY valid JSON.`,
      },
    });
    return cleanAndParseJson(response.text || "{}");
  } catch (error) {
    console.error("Chatbot Error:", error);
    return { reply: "Technical glitch in my matrix. Please try again.", action: "NONE" };
  }
}

export const geminiService = {
  translateItemName,
  generatePriceAdvisory,
  getSmartNoteCategorization,
  parseItemDescription,
  analyzeNotes,
  analyzeInventory,
  processChatCommand
};
