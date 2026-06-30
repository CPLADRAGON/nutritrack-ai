import { UserProfile, GoalType, ActivityLevel } from '../types';

/** Activity multipliers for the Mifflin-St Jeor BMR → TDEE calculation. */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHTLY_ACTIVE]: 1.375,
  [ActivityLevel.MODERATELY_ACTIVE]: 1.55,
  [ActivityLevel.VERY_ACTIVE]: 1.725,
};

/**
 * Mifflin-St Jeor BMR formula.
 * Returns basal metabolic rate in kcal/day.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'MALE' | 'FEMALE',
): number {
  if (gender === 'MALE') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

/** Calculate TDEE from BMR + activity level. */
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'MALE' | 'FEMALE',
  activityLevel: ActivityLevel,
): number {
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2));
}

/** Return target daily calories based on TDEE and goal. */
export function getTargetCalories(tdee: number, goal: GoalType): number {
  switch (goal) {
    case GoalType.LOSE_WEIGHT:
      return Math.round(tdee - 500); // ~0.5 kg/week deficit
    case GoalType.GAIN_MUSCLE:
      return Math.round(tdee + 300); // modest surplus
    default:
      return tdee;
  }
}

/** Protein target in grams, based on goal and body weight. */
function getTargetProtein(weightKg: number, goal: GoalType): number {
  switch (goal) {
    case GoalType.LOSE_WEIGHT:
      return Math.round(weightKg * 2.0);  // higher protein to preserve muscle in deficit
    case GoalType.GAIN_MUSCLE:
      return Math.round(weightKg * 1.8);
    default:
      return Math.round(weightKg * 1.6);
  }
}

/**
 * Goal-based macro split from remaining calories (after subtracting protein).
 * - Lose: higher protein, moderate fat, lower carbs
 * - Gain: moderate protein, higher carbs, moderate fat
 * - Maintain: balanced
 */
export function calculateMacros(
  tdee: number,
  weightKg: number,
  goal: GoalType,
): { targetCalories: number; targetProtein: number; targetCarbs: number; targetFat: number } {
  const targetCalories = getTargetCalories(tdee, goal);
  const targetProtein = getTargetProtein(weightKg, goal);
  const proteinCals = targetProtein * 4;
  const remainingCals = targetCalories - proteinCals;

  let fatFraction: number;
  let carbFraction: number;

  switch (goal) {
    case GoalType.LOSE_WEIGHT:
      fatFraction = 0.30;  // 30% fat
      carbFraction = 0.70; // 70% carbs of remaining
      break;
    case GoalType.GAIN_MUSCLE:
      fatFraction = 0.25;
      carbFraction = 0.75;
      break;
    default:
      fatFraction = 0.30;
      carbFraction = 0.70;
  }

  const targetFat = Math.round((remainingCals * fatFraction) / 9);
  const targetCarbs = Math.round((remainingCals * carbFraction) / 4);

  return { targetCalories, targetProtein, targetCarbs, targetFat };
}

/** Fields on UserProfile that should trigger a TDEE recalculation when changed. */
const TDEE_SENSITIVE_FIELDS = new Set<keyof UserProfile>([
  'weight', 'height', 'age', 'gender', 'activityLevel', 'goal',
]);

/** Returns true if any TDEE-sensitive field differs between old and new profile. */
export function shouldRecalculateTDEE(
  prev: UserProfile | null,
  next: UserProfile,
): boolean {
  if (!prev) return true;
  for (const field of TDEE_SENSITIVE_FIELDS) {
    if (prev[field] !== next[field]) return true;
  }
  return false;
}
