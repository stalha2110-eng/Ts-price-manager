import { GoogleGenAI, Type } from "@google/genai";
import { Translations, Item, Note } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

/**
 * Translates item names into English, Hindi, Marathi, and Hinglish.
 */
export async function translateItemName(name: string): Promise<Translations> {
  if (!process.env.GEMINI_API_KEY) {
    return { en: name, hi: name, mr: name, 'hi-en': name };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Translate this business item name (Dry Fruit/Masala/Spice) into English, Hindi, Marathi, and Hinglish (Hindi written in English alphabets). Returns a pure JSON object with keys: en, hi, mr, hi-en. Item name: ${name}`,
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
          required: ['en', 'hi', 'mr', 'hi-en'],
        },
      },
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini API");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    if (error?.status === 403 || error?.message?.includes("403")) {
      console.warn("Permission denied for Gemini model. Please check if the model is available for your API key/region.");
    }
    return { en: name, hi: name, mr: name, 'hi-en': name };
  }
}

/**
 * Generates a strategic price advisory for an item based on its data.
 */
export async function generatePriceAdvisory(item: Item): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `As a professional business consultant for a dry fruit and spice wholesale business, provide a concise (max 20 words) strategic price advice for this item. 
      Details: ${item.translations.en}, Buying Price: ${item.buyingPrice}/${item.buyingPriceUnit}, Retail: ${item.retailPrice}/${item.retailPriceUnit}. 
      Return only the advice text.`,
    });

    if (!response.text) return "";
    return response.text.trim();
  } catch (error: any) {
    console.error("Gemini Advisory Error:", error);
    return "";
  }
}

/**
 * Categorizes the priority of a note based on its content.
 */
export async function getSmartNoteCategorization(title: string, description: string): Promise<'Urgent' | 'Important' | 'Info'> {
  if (!process.env.GEMINI_API_KEY) return 'Info';

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Determine the priority for this business note. 
      Title: ${title}
      Description: ${description}
      Categorize as 'Urgent', 'Important', or 'Info'. Return only the category name.`,
    });

    if (!response.text) return 'Info';
    const priority = response.text.trim();
    if (priority.includes('Urgent')) return 'Urgent';
    if (priority.includes('Important')) return 'Important';
    return 'Info';
  } catch (error: any) {
    console.error("Gemini Categorization Error:", error);
    return 'Info';
  }
}
