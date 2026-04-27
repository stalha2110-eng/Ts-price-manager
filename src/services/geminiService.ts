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
    if (!ai) throw new Error("AI not initialized");
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: `Translate the product name "${name}" into Hindi, Marathi, and Hinglish. Return ONLY JSON like {en: string, hi: string, mr: string, 'hi-en': string}` }] }],
      config: {
        systemInstruction: "You are a multilingual translator for an Indian inventory app. Return ONLY JSON.",
        responseMimeType: "application/json"
      }
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
    if (!ai) throw new Error("AI not initialized");
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: `Analyze pricing:
      Name: ${item.name}
      Buy: ${item.buyingPrice}
      Wholesale: ${item.wholesalePrice}
      Retail: ${item.retailPrice}` }] }],
      config: {
        systemInstruction: "Provide a quick, 2-sentence pricing advice. Is the margin healthy? Any trends? Be professional and direct."
      }
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
    if (!ai) return "Normal";
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: `Categorize this note: Title: ${title}, Body: ${description}` }] }],
      config: {
        systemInstruction: "Categorize. Return ONE: Urgent, Important, Medium, Normal."
      }
    });
    return response.text?.trim() || "Normal";
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
    if (!ai) return "Analysis unavailable.";

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: `Analyze: \n${notes.join("\n---\n")}` }] }],
      config: {
        systemInstruction: "Summarize into bulleted Action Items."
      }
    });
    return response.text || "No insights found.";
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
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: `Extract item details from: "${input}"` }] }],
      config: {
        systemInstruction: "Extract product details for a Dry Fruits & Masala Store. Return JSON only.",
        responseMimeType: "application/json"
      }
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
    if (!ai) return "Intelligence matrix offline.";

    const summary = items.map(i => `${i.name}: Buy ₹${i.buyingPrice}, Sell ₹${i.retailPrice}`).join(', ');
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: `Analyze this inventory: ${summary.slice(0, 2000)}` }] }],
      config: {
        systemInstruction: "You are a business manager. Give a single, powerful sentence summary of the inventory health and pricing strategy."
      }
    });

    return response.text || "Inventory balance within operational parameters.";
  } catch (error) {
    return "Intelligence matrix offline.";
  }
}

/**
 * Advanced Chatbot logic: Processes natural language commands into application actions.
 */
export const geminiService = {
  translateItemName,
  generatePriceAdvisory,
  getSmartNoteCategorization,
  parseItemDescription,
  analyzeNotes,
  analyzeInventory
};
