import { MealLog, UserProfile, WeightLog } from "../types";

const STORAGE_KEY_PREFIX = 'nutritrack_';

export const saveUser = (user: UserProfile) => {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}user_${user.name}`, JSON.stringify(user));
  localStorage.setItem(`${STORAGE_KEY_PREFIX}last_user`, user.name);
};

export const loadUser = (name: string): UserProfile | null => {
  const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}user_${name}`);
  return data ? JSON.parse(data) : null;
};

export const getLastUser = (): string | null => {
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}last_user`);
};

export const getAllUsers = (): UserProfile[] => {
  const users: UserProfile[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(`${STORAGE_KEY_PREFIX}user_`)) {
      const userData = localStorage.getItem(key);
      if (userData) {
        users.push(JSON.parse(userData));
      }
    }
  }
  return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const saveLogs = (username: string, logs: MealLog[]) => {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}logs_${username}`, JSON.stringify(logs));
};

export const loadLogs = (username: string): MealLog[] => {
  const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}logs_${username}`);
  return data ? JSON.parse(data) : [];
};

export const saveWeightHistory = (username: string, history: WeightLog[]) => {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}weight_${username}`, JSON.stringify(history));
};

export const loadWeightHistory = (username: string): WeightLog[] => {
  const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}weight_${username}`);
  return data ? JSON.parse(data) : [];
};