// This variable is now injected by Vite at build time via GitHub Secrets
// For local development, create a .env file with VITE_GOOGLE_CLIENT_ID=your_id

declare const process: {
    env: {
        VITE_GOOGLE_CLIENT_ID: string;
    };
};

export const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || "";

export const SPREADSHEET_TITLE = "NutriTrack AI Data";