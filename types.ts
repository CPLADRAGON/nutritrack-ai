export enum GoalType {
  LOSE_WEIGHT = 'LOSE_WEIGHT',
  MAINTAIN = 'MAINTAIN',
  GAIN_MUSCLE = 'GAIN_MUSCLE'
}

export enum ActivityLevel {
  SEDENTARY = 'SEDENTARY',
  LIGHTLY_ACTIVE = 'LIGHTLY_ACTIVE',
  MODERATELY_ACTIVE = 'MODERATELY_ACTIVE',
  VERY_ACTIVE = 'VERY_ACTIVE'
}

export enum MealType {
  BREAKFAST = 'Breakfast',
  LUNCH = 'Lunch',
  DINNER = 'Dinner',
  SNACK = 'Snack'
}

/** Migrate legacy Chinese meal-type values to English enum values. */
export function normalizeMealType(type: string): MealType {
  const legacy: Record<string, MealType> = {
    '早餐': MealType.BREAKFAST,
    '午餐': MealType.LUNCH,
    '晚餐': MealType.DINNER,
    '加餐': MealType.SNACK,
  };
  return legacy[type] ?? (type as MealType);
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE';
  height: number; // cm
  weight: number; // kg
  activityLevel: ActivityLevel;
  goal: GoalType;
  tdee: number; // Total Daily Energy Expenditure (Maintenance Calories)
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  createdAt: string;
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealLog {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: MealType;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl?: string;
}

export interface WeightLog {
  date: string;
  weight: number;
}

export interface AppState {
  currentUser: UserProfile | null;
  logs: MealLog[];
  weightHistory: WeightLog[];
}

// --- Weight Calculation Types ---

export interface WeeklyAverage {
  weekId: string;       // "2026-W27"
  label: string;        // "Jun 29 – Jul 5"
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface MovingAveragePoint {
  date: string;         // YYYY-MM-DD
  weight: number;
  movingAvg: number | null;
}

export interface WeightTrend {
  weeklyRate: number | null;  // kg per week (negative = losing)
  direction: 'down' | 'up' | 'stable' | null;
}

export interface WeekComparison {
  currentAvg: number;
  lastAvg: number;
  delta: number;
  currentLabel: string;
  lastLabel: string;
}