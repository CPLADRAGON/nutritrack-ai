import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, MealLog } from "../types";

// Declare process to satisfy TS compiler since Vite injects it
declare const process: {
  env: {
    API_KEY: string;
  };
};

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema for Food Analysis
const foodAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    foodName: { type: Type.STRING, description: "Name of the dish or food items identified" },
    calories: { type: Type.NUMBER, description: "Estimated total calories (kcal)" },
    protein: { type: Type.NUMBER, description: "Estimated protein in grams" },
    carbs: { type: Type.NUMBER, description: "Estimated carbohydrates in grams" },
    fat: { type: Type.NUMBER, description: "Estimated fat in grams" },
    reasoning: { type: Type.STRING, description: "Short explanation of the estimation" }
  },
  required: ["foodName", "calories", "protein", "carbs", "fat"]
};

// Schema for Profile Planning
const profilePlanSchema = {
  type: Type.OBJECT,
  properties: {
    targetCalories: { type: Type.NUMBER },
    targetProtein: { type: Type.NUMBER },
    targetCarbs: { type: Type.NUMBER },
    targetFat: { type: Type.NUMBER },
    advice: { type: Type.STRING, description: "Brief advice based on body data" }
  },
  required: ["targetCalories", "targetProtein", "targetCarbs", "targetFat", "advice"]
};

export const analyzeFoodImage = async (base64Image: string): Promise<any> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: "Analyze this food image. Identify the food, estimate the portion size, and provide the nutritional content (Calories, Protein, Carbs, Fat). Be realistic. If it's a combo meal, sum them up."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: foodAnalysisSchema,
        systemInstruction: "You are an expert nutritionist and dietitian. You are analyzing photos of food to help a user track their daily intake."
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini Food Analysis Error:", error);
    throw error;
  }
};

export const generatePlanFromProfile = async (profile: Partial<UserProfile>): Promise<any> => {
  const ai = getAiClient();
  const prompt = `
    User Profile:
    Age: ${profile.age}
    Gender: ${profile.gender}
    Height: ${profile.height}cm
    Weight: ${profile.weight}kg
    Activity Level: ${profile.activityLevel}
    Goal: ${profile.goal}

    Calculate the daily caloric needs (TDEE) and recommended macronutrient split (Protein/Carbs/Fat) for this user to achieve their goal.
    Return JSON with targets and a short advice paragraph.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: profilePlanSchema,
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No plan generated");
  } catch (error) {
    console.error("Gemini Plan Generation Error:", error);
    throw error;
  }
};

export const getDailyAdvice = async (profile: UserProfile, logs: MealLog[]): Promise<string> => {
  const ai = getAiClient();
  // Filter for today's logs or recent logs
  const recentLogsStr = logs.slice(0, 10).map(l => `${l.date} ${l.type}: ${l.description} (${l.calories}kcal)`).join('\n');

  const prompt = `
    User: ${profile.name}, Goal: ${profile.goal}.
    Target: ${profile.targetCalories} kcal.
    Recent Logs:
    ${recentLogsStr}

    Provide a short, encouraging, and actionable summary advice for the user based on their recent eating habits and their goal. (Max 2 sentences).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Keep tracking to get better advice!";
  } catch (e) {
    return "Great job tracking your meals!";
  }
};