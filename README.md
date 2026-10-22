# 🥗 NutriTrack AI

**NutriTrack AI** is a privacy-focused personal nutrition assistant. It uses **Google Gemini** to analyze food photos or descriptions, tracks your macros against your goals, and stores all your data securely in your own **Google Sheets** via your Google Drive.

The app is a React SPA served from **Cloudflare Workers**, with a small Worker backend that handles Google OAuth so you stay signed in across sessions.

> **Zero cost**: Designed to run on free tiers (Cloudflare Workers + Gemini Free Tier + Google Sheets API).

## ✨ Features

### 🧠 AI Intelligence
*   **Smart Food Analysis**: Upload a photo 📸 OR describe your meal in text 📝 (e.g., "Chicken rice with extra egg"). Gemini estimates calories, protein, carbs, and fat.
*   **"What should I eat?"**: Context-aware suggestions based on your remaining macros, the time of day, and what you've already eaten.
*   **TDEE Calculator**: Automatically calculates your Total Daily Energy Expenditure (Maintenance Calories) based on your profile and activity level.
*   **Daily Insights**: AI-generated advice banner that adapts to your recent eating habits.

### 📊 Data & Tracking
*   **Google Sheets Database**: No 3rd party database. Your data lives in a spreadsheet (`NutriTrack AI Data`) in *your* Google Drive.
*   **Calorie Deficit Monitor**: Real-time tracking of your daily and all-time calorie deficit.
*   **Macro Tracking**: Progress indicators for Calories, Protein, Carbs, and Fat.
*   **Weight Trend**: Interactive line chart to visualize weight changes over time.
*   **Timezone Smart**: Uses Singapore Time (UTC+8) for consistent daily logging.

### 🎨 Modern UI
*   **Glassmorphism Design**: Backdrop blurs and smooth animations.
*   **Interactive Charts**: 7, 30, and 90-day views for calorie and weight history.
*   **PWA-Ready**: Responsive on mobile and desktop.

## 🚀 Live App

[https://nutritrack-ai.wby1279501447.workers.dev](https://nutritrack-ai.wby1279501447.workers.dev)

## 🏗️ How It Works

```
Browser (React SPA)
  ├── Google Sheets / Drive API  ── your data lives in your Drive
  └── /api/auth/*  ── Cloudflare Worker
                        ├── Google OAuth (authorization code flow)
                        └── KV: refresh token + opaque session
```

*   `GET /api/auth/login` starts Google sign-in.
*   `GET /api/auth/callback` exchanges the code and stores the refresh token **server-side**.
*   `GET /api/auth/token` returns a fresh 1-hour access token to the browser.
*   `POST /api/auth/logout` revokes and deletes the session.

The browser never receives the refresh token — only an `HttpOnly`, `Secure` session cookie.

## 🛠️ Prerequisites

1.  **Node.js** (v18 or higher)
2.  A **Google Cloud Project** (OAuth + Sheets + Drive APIs)
3.  A **Google Gemini API Key**
4.  A **Cloudflare account** (free) for deployment

## ⚙️ Configuration

### 1. Gemini API Key
1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Create a free API key.

### 2. Google Cloud (OAuth & Sheets)
1.  Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2.  Enable **Google Sheets API** and **Google Drive API**.
3.  Configure the OAuth consent screen (External).
    *   **Publish the app** (Audience → *Publish app*). This is required: refresh tokens issued by apps in **Testing** expire after 7 days.
    *   If you stay in Testing, add each user under **Test users** (max 100).
4.  Create an **OAuth Client ID** → **Web application**.
    *   **Authorized redirect URI** (exact):
        `https://nutritrack-ai.wby1279501447.workers.dev/api/auth/callback`
        Add `http://localhost:8788/api/auth/callback` if you test locally with Wrangler.
    *   The only scope requested is `https://www.googleapis.com/auth/drive.file` (per-file access to the spreadsheet the app creates).

### 3. Cloudflare Worker
1.  Create a **KV namespace** (Storage & Databases → KV) and put its ID in `wrangler.jsonc` under `kv_namespaces` with binding `SESSIONS`.
2.  **Build variables**: `VITE_API_KEY` = your Gemini key.
3.  **Runtime variables/secrets** (Worker → Settings → Variables and Secrets):
    *   `GOOGLE_CLIENT_ID`
    *   `GOOGLE_CLIENT_SECRET` (Secret)
4.  Connect the repository via **Workers Builds** (Workers & Pages → Create → Import a repository):
    *   Build command: `npm run build`
    *   Deploy command: `npx wrangler deploy`
    *   Root directory: blank (repository root)

## 💻 Local Development

```bash
git clone https://github.com/CPLADGRON/nutritrack-ai.git
cd nutritrack-ai
npm install
```

Create `.env` for the frontend build:

```env
API_KEY=your_gemini_api_key_here
```

Run the UI only (no auth endpoints):

```bash
npm run dev
```

Run the full app (SPA + Worker + local KV):

```bash
npm run build
# .dev.vars: GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
npx wrangler dev
```

Register `http://localhost:8788/api/auth/callback` in Google Cloud for local auth.

## ☁️ Deployment

Production runs on **Cloudflare Workers** (Workers Builds from this repo). Every push to `main` builds with `npm run build` and deploys with `npx wrangler deploy`.

The legacy GitHub Pages workflow (`.github/workflows/deploy.yml`) is no longer used; disable or delete it after verifying the Cloudflare deployment.

## ❓ Troubleshooting

### Error 400: redirect_uri_mismatch
*   **Cause**: The callback URL doesn't exactly match Google Cloud.
*   **Fix**: Add the exact redirect URI under **Authorized redirect URIs** — not *Authorized JavaScript origins*. It must match scheme, host, and path.

### Error 403: access_denied
*   **Cause**: The app is in Testing and the user isn't a test user.
*   **Fix**: Add their email under **Test users**, or publish the app.

### Sign-in works, but you're asked to sign in again every week
*   **Cause**: The OAuth app is still in **Testing**; refresh tokens expire after 7 days.
*   **Fix**: **Publish app** in Google Auth Platform → Audience.

### `server_misconfigured` when signing in
*   **Cause**: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `SESSIONS` are missing in the Worker.
*   **Fix**: Add the runtime variables and KV binding, then redeploy.

### Sheets calls return 403 `insufficientPermissions`
*   **Cause**: `drive.file` did not cover an operation.
*   **Fix**: Add `https://www.googleapis.com/auth/spreadsheets` to `SCOPES` in `functions/api/auth/_shared.js` and sign in again.

## 🏗️ Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS, Glassmorphism
*   **Charts**: Recharts
*   **AI**: Google Gemini SDK (`@google/genai`)
*   **Backend**: Cloudflare Workers (Static Assets + Functions-style handlers)
*   **Auth**: Google OAuth 2.0 authorization-code flow, KV sessions
*   **Storage**: Google Sheets API v4 / Drive API v3 (`drive.file`)

## 🔒 Privacy

*   **Data**: Stored in *your* Google Drive. The app developer has no access to it.
*   **Auth**: The refresh token is stored in Cloudflare KV, keyed by an opaque session ID. The browser only holds a 1-hour access token and an `HttpOnly` session cookie.
*   **AI**: Food images/text are sent to Google Gemini for analysis; only the results are saved to your Sheet.
*   **Note**: The Gemini API key is embedded in the client bundle at build time (`VITE_API_KEY`), so this deployment is intended for personal use.
