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
    tdee: { type: Type.NUMBER, description: "Total Daily Energy Expenditure (Maintenance Calories)" },
    targetCalories: { type: Type.NUMBER },
    targetProtein: { type: Type.NUMBER },
    targetCarbs: { type: Type.NUMBER },
    targetFat: { type: Type.NUMBER },
    advice: { type: Type.STRING, description: "Brief advice based on body data" }
  },
  required: ["tdee", "targetCalories", "targetProtein", "targetCarbs", "targetFat", "advice"]
};

export const analyzeFood = async (base64Image: string | null, textDescription: string): Promise<any> => {
  const ai = getAiClient();

  try {
    const parts: any[] = [];

    // Add Image if present
    if (base64Image) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    // Construct prompt based on available inputs
    let promptText = "Analyze the food inputs. Identify the food, estimate the portion size, and provide the nutritional content (Calories, Protein, Carbs, Fat). Be realistic. If it's a combo meal, sum them up.";

    if (textDescription) {
      promptText += `\nUser Description: "${textDescription}". Use this description to aid identification or estimation.`;
    }

    if (!base64Image && !textDescription) {
      throw new Error("Please provide an image or a description.");
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: foodAnalysisSchema,
        systemInstruction: "You are an expert nutritionist and dietitian. You are analyzing photos or descriptions of food to help a user track their daily intake."
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

    1. Calculate the user's TDEE (Maintenance Calories).
    2. Calculate the daily caloric target based on their goal (e.g. deficit for weight loss).
    3. Calculate recommended macronutrient split (Protein/Carbs/Fat).
    Return JSON with TDEE, targets and a short advice paragraph.
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

export const getFoodSuggestion = async (
  remaining: { calories: number; protein: number; carbs: number; fat: number },
  goal: string
): Promise<string> => {
  const ai = getAiClient();

  const prompt = `
    I have the following macro allowance left for today:
    Calories: ${remaining.calories} kcal
    Protein: ${remaining.protein} g
    Carbs: ${remaining.carbs} g
    Fat: ${remaining.fat} g
    
    My overall goal is: ${goal}.

    Based on these remaining numbers, suggest 2 or 3 specific, simple snack or meal options that fit within this budget. 
    If the numbers are negative (meaning I overate), suggest something extremely light like tea or cucumber slices.
    Keep the answer conversational, short, and appetizing. Max 50 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "Try a light protein snack!";
  } catch (e) {
    console.error("Suggestion Error", e);
    return "Could not generate suggestion right now.";
  }
};