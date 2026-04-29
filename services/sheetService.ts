import { UserProfile, MealLog, WeightLog } from "../types";
import { SPREADSHEET_TITLE } from "../config";

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

export class SheetService {
  private accessToken: string;
  private spreadsheetId: string | null = null;
  private initializing: Promise<boolean> | null = null;
  private onTokenExpired?: () => void;

  constructor(token: string, onTokenExpired?: () => void) {
    this.accessToken = token;
    this.onTokenExpired = onTokenExpired;
  }

  private async fetch(url: string, options: RequestInit = {}) {
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        this.onTokenExpired?.();
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(error.error?.message || 'API request failed');
    }
    return response.json();
  }

  async init(): Promise<boolean> {
    // Idempotency: if already initializing or initialized, return existing result
    if (this.spreadsheetId) return true;
    if (this.initializing) return this.initializing;

    this.initializing = this._doInit();
    try {
      return await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  private async _doInit(): Promise<boolean> {
    const query = `name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchResult = await this.fetch(`${DRIVE_API_BASE}?q=${encodeURIComponent(query)}`);

    if (searchResult.files && searchResult.files.length > 0) {
      this.spreadsheetId = searchResult.files[0].id;
      return true;
    } else {
      await this.createSpreadsheet();
      return false;
    }
  }

  private async createSpreadsheet() {
    const body = {
      properties: { title: SPREADSHEET_TITLE },
      sheets: [
        { properties: { title: 'Profile' } },
        { properties: { title: 'Logs' } },
        { properties: { title: 'Weight' } }
      ]
    };
    const result = await this.fetch(SHEETS_API_BASE, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    this.spreadsheetId = result.spreadsheetId;

    // Initialize headers
    await this.writeRange('Profile!A1:N1', [['ID', 'Name', 'Age', 'Gender', 'Height', 'Weight', 'Activity', 'Goal', 'TargetCals', 'TargetP', 'TargetC', 'TargetF', 'CreatedAt', 'TDEE']]);
    await this.writeRange('Logs!A1:I1', [['ID', 'Date', 'Time', 'Type', 'Description', 'Calories', 'P', 'C', 'F']]);
    await this.writeRange('Weight!A1:B1', [['Date', 'Weight']]);
  }

  private async writeRange(range: string, values: any[][]) {
    if (!this.spreadsheetId) throw new Error("Spreadsheet not initialized");
    const url = `${SHEETS_API_BASE}/${this.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
    await this.fetch(url, {
      method: 'PUT',
      body: JSON.stringify({ values })
    });
  }

  // --- Data Access Methods ---

  async loadData(): Promise<{ user: UserProfile | null, logs: MealLog[], weight: WeightLog[] }> {
    if (!this.spreadsheetId) throw new Error("Spreadsheet not initialized");

    // Batch get all sheets
    const url = `${SHEETS_API_BASE}/${this.spreadsheetId}/values:batchGet?ranges=Profile!A2:N2&ranges=Logs!A2:I&ranges=Weight!A2:B`;
    const result = await this.fetch(url);

    const profileRows = result.valueRanges[0].values;
    const logRows = result.valueRanges[1].values;
    const weightRows = result.valueRanges[2].values;

    let user: UserProfile | null = null;
    if (profileRows && profileRows.length > 0) {
      const row = profileRows[0];
      user = {
        id: row[0],
        name: row[1],
        age: Number(row[2]),
        gender: row[3],
        height: Number(row[4]),
        weight: Number(row[5]),
        activityLevel: row[6],
        goal: row[7],
        targetCalories: Number(row[8]),
        targetProtein: Number(row[9]),
        targetCarbs: Number(row[10]),
        targetFat: Number(row[11]),
        createdAt: row[12],
        // Default TDEE to target + 300 if missing (migration strategy) or just set to target
        tdee: row[13] ? Number(row[13]) : Number(row[8])
      };
    }

    const logs: MealLog[] = logRows ? logRows.map((row: any[]) => ({
      id: row[0],
      date: row[1],
      time: row[2],
      type: row[3],
      description: row[4],
      calories: Number(row[5]),
      protein: Number(row[6]),
      carbs: Number(row[7]),
      fat: Number(row[8]),
      // Image URL intentionally excluded from sync to avoid payload limits
    })) : [];

    const weight: WeightLog[] = weightRows ? weightRows.map((row: any[]) => ({
      date: row[0],
      weight: Number(row[1])
    })) : [];

    return { user, logs: logs.reverse(), weight };
  }

  async saveUser(user: UserProfile) {
    const row = [
      user.id, user.name, user.age, user.gender, user.height, user.weight,
      user.activityLevel, user.goal, user.targetCalories, user.targetProtein,
      user.targetCarbs, user.targetFat, user.createdAt, user.tdee
    ];
    await this.writeRange('Profile!A2:N2', [row]);
  }

  async saveLogs(logs: MealLog[]) {
    if (!this.spreadsheetId) return;

    // Sort chronologically
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = a.date + a.time;
      const dateB = b.date + b.time;
      return dateA.localeCompare(dateB);
    });

    if (sortedLogs.length === 0) {
      // Only clear if there's nothing to write
      const clearUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Logs!A2:I:clear`;
      await this.fetch(clearUrl, { method: 'POST' });
      return;
    }

    const rows = sortedLogs.map(l => [
      l.id, l.date, l.time, l.type, l.description, l.calories, l.protein, l.carbs, l.fat
    ]);

    // Write new data first (atomic overwrite of the range we need)
    await this.writeRange(`Logs!A2:I${2 + rows.length - 1}`, rows);

    // Then clear any leftover rows beyond our data
    const clearRemainingUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Logs!A${2 + rows.length}:I:clear`;
    await this.fetch(clearRemainingUrl, { method: 'POST' });
  }

  async saveWeight(history: WeightLog[]) {
    if (!this.spreadsheetId) return;

    if (history.length === 0) {
      const clearUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Weight!A2:B:clear`;
      await this.fetch(clearUrl, { method: 'POST' });
      return;
    }

    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const rows = sortedHistory.map(w => [w.date, w.weight]);

    // Write first, then clear remaining rows
    await this.writeRange(`Weight!A2:B${2 + rows.length - 1}`, rows);
    const clearRemainingUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Weight!A${2 + rows.length}:B:clear`;
    await this.fetch(clearRemainingUrl, { method: 'POST' });
  }
}