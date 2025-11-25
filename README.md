# 🥗 NutriTrack AI

**NutriTrack AI** is a serverless, privacy-focused personal nutrition assistant. It uses **Google Gemini** to analyze food photos for calorie/macro estimation and stores all your data securely in your own **Google Sheets** via your Google Drive.

> **Zero Cost**: This project is designed to run entirely on free tiers (GitHub Pages + Gemini Free Tier + Google Sheets API).

## ✨ Features

*   **AI Food Analysis**: Upload a photo of your meal, and Gemini estimates calories, protein, carbs, and fat.
*   **Personalized Plans**: Enter your body metrics (height, weight, age, goal), and the AI calculates your optimal daily targets (TDEE).
*   **Google Sheets Database**: No 3rd party database. Your data lives in a spreadsheet in *your* Google Drive.
*   **Progress Tracking**:
    *   Interactive charts for Calorie Intake and Weight History.
    *   Adjustable time ranges (7, 30, 90 days).
*   **Daily Insights**: AI-generated advice based on your recent logs.
*   **PWA-Ready**: Responsive design works great on mobile and desktop.

## 🚀 Live Demo

[View Live App](https://cpladragon.github.io/nutritrack-ai/)

## 🛠️ Prerequisites

To run this project, you need:

1.  **Node.js** (v18 or higher)
2.  A **Google Cloud Project** (for Login & Sheets)
3.  A **Google Gemini API Key** (for AI analysis)

---

## ⚙️ Configuration Guide

### 1. Get Gemini API Key
1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Create a free API Key.

### 2. Setup Google Cloud (OAuth & Sheets)
1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project.
3.  **Enable APIs**: Search for and enable **"Google Sheets API"** and **"Google Drive API"**.
4.  **Configure OAuth Consent**:
    *   Select "External" User Type.
    *   **Important**: Add your email to **"Test Users"** (since the app is not verified).
5.  **Create Credentials**:
    *   Create an **OAuth Client ID** -> **Web Application**.
    *   **Authorized JavaScript origins**:
        *   Localhost: `http://localhost:5173`
        *   Production: `https://<your-github-username>.github.io`
    *   Copy the **Client ID**.

---

## 💻 Local Development

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/nutritrack.git
    cd nutritrack
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables**
    Create a file named `.env` in the root directory:
    ```env
    API_KEY=your_gemini_api_key_here
    GOOGLE_CLIENT_ID=your_google_client_id_here
    ```

4.  **Run the app**
    ```bash
    npm run dev
    ```

---

## ☁️ Deployment (GitHub Pages)

This project uses **GitHub Actions** to automatically build and deploy.

1.  Push your code to GitHub.
2.  Go to your Repository **Settings** -> **Secrets and variables** -> **Actions**.
3.  Add two **Repository secrets**:
    *   `API_KEY`: (Your Gemini Key)
    *   `GOOGLE_CLIENT_ID`: (Your OAuth Client ID)
4.  Go to **Settings** -> **Pages**.
    *   Source: **GitHub Actions**.
5.  Go to the **Actions** tab in GitHub and watch the workflow run. Once green, your site is live!

---

## ❓ Troubleshooting

### Error 400: redirect_uri_mismatch
*   **Cause**: The URL in your browser does not match what is in Google Cloud Console.
*   **Fix**: Go to Google Cloud Credentials, edit your Client ID, and add your exact domain (e.g., `https://user.github.io`) to **Authorized JavaScript origins**.

### Error 403: access_denied
*   **Cause**: The app is in "Testing" mode and you aren't on the list.
*   **Fix**: Go to Google Cloud **OAuth consent screen**, scroll down to **Test users**, and add your email address.

### "Configuration Missing" on Login
*   **Cause**: The `GOOGLE_CLIENT_ID` was not injected during the build.
*   **Fix**: Ensure you added the Secret in GitHub Settings and re-ran the Action.

---

## 🏗️ Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Charts**: Recharts
*   **AI**: Google Gemini SDK (`@google/genai`)
*   **Storage**: Google Sheets API v4

## 🔒 Privacy

This application is **serverless**. It runs entirely in your browser.
*   **Authentication**: Handled directly by Google.
*   **Data**: Stored in *your* Google Drive. The developer of this app has no access to your data.
*   **AI**: Images are sent to Google Gemini for analysis but are not stored by the application.
