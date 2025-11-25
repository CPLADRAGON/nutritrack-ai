// This variable is now injected by Vite at build time via GitHub Secrets
// For local development, create a .env file with GOOGLE_CLIENT_ID=your_id

// Declare process to satisfy TS compiler (Vite replaces this at build time)
declare const process: {
    env: {
        GOOGLE_CLIENT_ID: string;
    };
};

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

export const SPREADSHEET_TITLE = "NutriTrack AI Data";