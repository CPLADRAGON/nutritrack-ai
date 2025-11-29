import { UserProfile, MealLog, WeightLog } from "../types";
import { SPREADSHEET_TITLE } from "../config";

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';

export class SheetService {
  private accessToken: string;
  private spreadsheetId: string | null = null;

  constructor(token: string) {
    this.accessToken = token;
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
      throw new Error(error.error?.message || 'API request failed');
    }
    return response.json();
  }

  async init(): Promise<boolean> {
    // 1. Search for existing spreadsheet
    const query = `name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchResult = await this.fetch(`${DRIVE_API_BASE}?q=${encodeURIComponent(query)}`);

    if (searchResult.files && searchResult.files.length > 0) {
      this.spreadsheetId = searchResult.files[0].id;
      return true; // Found
    } else {
      await this.createSpreadsheet();
      return false; // Created new
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
    // For simplicity and to handle edits/deletes, we overwrite the log sheet.
    // In a production app with huge data, we would append or update specific rows.
    // We clear the sheet first or just overwrite.
    // Note: This approach assumes < 2000 logs which is fine for personal use.

    // 1. Clear existing logs (optional but safer for deletes) - simpler to just overwrite a large range
    // but Sheets API overwrite doesn't clear 'remaining' rows if new list is shorter.
    // So we clear first.
    if (!this.spreadsheetId) return;

    const clearUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Logs!A2:I:clear`;
    await this.fetch(clearUrl, { method: 'POST' });

    // 2. Write new logs
    // Sort chronologically for sheet (logs passed in might be reverse chrono)
    // We use string comparison for robustness (Timezone Agnostic)
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = a.date + a.time;
      const dateB = b.date + b.time;
      return dateA.localeCompare(dateB);
    });

    if (sortedLogs.length === 0) return;

    const rows = sortedLogs.map(l => [
      l.id, l.date, l.time, l.type, l.description, l.calories, l.protein, l.carbs, l.fat
    ]);

    await this.writeRange(`Logs!A2:I${2 + rows.length - 1}`, rows);
  }

  async saveWeight(history: WeightLog[]) {
    if (!this.spreadsheetId) return;
    const clearUrl = `${SHEETS_API_BASE}/${this.spreadsheetId}/values/Weight!A2:B:clear`;
    await this.fetch(clearUrl, { method: 'POST' });

    if (history.length === 0) return;

    // Ensure history is sorted by date string before saving
    const sortedHistory = [...history].sort((a, b) => a.date.localeCompare(b.date));

    const rows = sortedHistory.map(w => [w.date, w.weight]);
    await this.writeRange(`Weight!A2:B${2 + rows.length - 1}`, rows);
  }
}