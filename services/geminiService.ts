import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, MealLog } from "../types";

declare const process: {
  env: {
    VITE_API_KEY: string;
  };
};

const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

const getAiClient = () => {
  if (!process.env.VITE_API_KEY) {
    throw new Error('Gemini API key is missing. For local development, add VITE_API_KEY to a .env file. For deployment, redeploy after setting the API_KEY GitHub Actions secret.');
  }
  return new GoogleGenAI({ apiKey: process.env.VITE_API_KEY });
};

// Retry wrapper with exponential backoff for transient/rate-limit errors
const withRetry = async <T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.httpStatusCode;
      const isRetryable = status === 429 || status === 503 || status === 500;
      if (!isRetryable || attempt === retries) throw error;
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
};

const isAuthError = (error: any) => error?.status === 401 || error?.status === 403 || error?.httpStatusCode === 401 || error?.httpStatusCode === 403;

const withModelFallback = async <T>(fn: (model: string) => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      return await withRetry(() => fn(model));
    } catch (error: any) {
      lastError = error;
      if (isAuthError(error)) throw error;
      console.warn(`Gemini model ${model} failed; trying fallback if available.`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Gemini models failed.');
};

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

    const response = await withModelFallback((model) => ai.models.generateContent({
      model,
      contents: {
        parts: parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: foodAnalysisSchema,
        systemInstruction: "You are an expert nutritionist and dietitian. You are analyzing photos or descriptions of food to help a user track their daily intake."
      }
    }));

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
    const response = await withModelFallback((model) => ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: profilePlanSchema,
      }
    }));

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
    const response = await withModelFallback((model) => ai.models.generateContent({
      model,
      contents: prompt,
    }));
    return response.text || "Keep tracking to get better advice!";
  } catch (e) {
    console.error("Daily Advice Error:", e);
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
    Markdown is allowed: use **bold** for food names and a short numbered list if helpful.
  `;

  try {
    const response = await withModelFallback((model) => ai.models.generateContent({
      model,
      contents: prompt,
    }));
    return response.text || "Try a light protein snack!";
  } catch (e) {
    console.error("Suggestion Error:", e);
    return "Could not generate suggestion right now.";
  }
};