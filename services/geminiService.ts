
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export const generateProductDescription = async (name: string, category: string): Promise<string> => {
  if (!apiKey) return "Fresh from the farm to your table. Organic, healthy, and high-quality produce.";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a high-converting, mouth-watering marketplace description for ${name} in the category ${category}. Keep it under 60 words. Emphasize organic quality and freshness in an Indian market context.`,
    });
    return response.text || "Fresh from the farm to your table. Organic, healthy, and high-quality produce.";
  } catch (error: any) {
    if (error?.message?.includes('429')) {
      return "Freshly harvested produce, locally grown with care. Perfect for your healthy kitchen needs.";
    }
    console.error("Gemini Error:", error);
    return "Freshly harvested produce, locally grown with care. Perfect for your healthy kitchen needs.";
  }
};

export const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  // 1. Try Gemini if API key is present
  if (apiKey) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tell me a short neighborhood name or region for these coordinates in India: Lat ${lat}, Lng ${lng}. Format: "City, Region" only.`,
      });
      return response.text?.trim() || "Unknown Area";
    } catch (error: any) {
      console.warn("Gemini reverse geo failed, falling back to OSM", error);
    }
  }

  // 2. Fallback to OpenStreetMap (Nominatim)
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: {
        'User-Agent': 'AgriConnect-App/1.0'
      }
    });
    const data = await response.json();
    if (data && data.address) {
      const city = data.address.city || data.address.town || data.address.village || data.address.suburb;
      const state = data.address.state;
      if (city) return state ? `${city}, ${state}` : city;
      return data.display_name.split(',').slice(0, 2).join(',');
    }
  } catch (e) {
    console.error("OSM reverse geo failed", e);
  }

  return "Local Farm Zone";
};

export const getCoordsFromAddress = async (address: string): Promise<{lat: number, lng: number}> => {
  // 1. Try Gemini if API key is present
  if (apiKey) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Return ONLY a JSON object with lat and lng coordinates for this place in India: "${address}". Example: {"lat": 28.6139, "lng": 77.2090}`,
      });
      const text = response.text || "";
      const jsonMatch = text.match(/\{.*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error: any) {
      console.warn("Gemini geo search failed, falling back to OSM", error);
    }
  }

  // 2. Fallback to OpenStreetMap (Nominatim)
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
      headers: {
        'User-Agent': 'AgriConnect-App/1.0'
      }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("OSM geo search failed", e);
  }

  return { lat: 20.5937, lng: 78.9629 }; // Default center of India
};

export const suggestPrice = async (name: string): Promise<string> => {
  if (!apiKey) return "50";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest a fair market price in Indian Rupees (INR) for 1kg of ${name} in a typical Indian city market. Return ONLY the number.`,
    });
    return response.text?.replace(/[^0-9]/g, '') || "50";
  } catch (error: any) {
    return "45";
  }
};

export const suggestUsage = async (name: string): Promise<string> => {
  if (!apiKey) return "Perfect for curries, salads, or traditional Indian snacks.";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Give 2 very short, creative Indian-style culinary uses or recipes for ${name}. Keep it under 30 words total.`,
    });
    return response.text || "Perfect for curries, salads, or traditional Indian snacks.";
  } catch (error: any) {
    return "Use in daily cooking for enhanced nutrition and taste.";
  }
};
