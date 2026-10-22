# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev          # Start Vite dev server (http://localhost:5173) — frontend only; /api/* returns 404
npm run build        # TypeScript check + Vite production build to ./dist
npm run preview      # Serve the production build locally
npx wrangler dev     # Serve ./dist + the Worker locally (auth works). Run npm run build first.
npx wrangler deploy  # Manual deploy; production normally deploys via Cloudflare's Git integration
```

No test suite, linter, or formatter is configured yet.

## Architecture

NutriTrack AI is a React 18 + TypeScript + Vite single-page app with **no client router**. It is served as static assets from a **Cloudflare Worker**, which also handles Google OAuth under `/api/auth/*`. All nutrition data lives in the user's own Google Drive via Sheets; AI calls go to Gemini.

### Tech Stack
- **Frontend**: React 18, TypeScript 5, Vite 5 — single-page app, no router
- **Styling**: Tailwind CSS (utility classes, glassmorphism touches, Inter font)
- **Charts**: Recharts (bar chart for calories, line chart for weight)
- **AI**: `@google/genai` (Gemini SDK) with structured JSON responses via schema constraints
- **Backend**: Cloudflare Workers Static Assets — `worker/index.js` plus handlers in `functions/api/auth/`
- **Auth**: Google OAuth 2.0 **authorization-code** flow (not GIS popups). Refresh token stored server-side in KV; browser receives an `HttpOnly` session cookie and a 1-hour access token.
- **Storage**: Google Sheets API v4 + Google Drive API v3 — spreadsheet auto-created in the user's Drive
- **Deployment**: Cloudflare Workers via `wrangler.jsonc` (Workers Builds from GitHub). The GitHub Pages workflow in `.github/workflows/deploy.yml` is legacy and should not be used.

### Auth Flow

```
GET  /api/auth/login     → redirect to Google (state cookie, access_type=offline, prompt=consent, scope drive.file)
GET  /api/auth/callback  → verify state, exchange code, store refresh token in KV under an opaque session id,
                           set nt_session (HttpOnly/Secure/SameSite=Lax), redirect to /
GET  /api/auth/token     → refresh token → 1-hour access token JSON for the browser
POST /api/auth/logout    → revoke refresh token, delete session, clear cookie
```

- The refresh token **never reaches the browser**; it lives in KV (`SESSIONS` binding).
- `wrangler.jsonc` sets `assets.run_worker_first: ["/api/*"]`. This is required: without it, the SPA fallback serves `index.html` for top-level navigations to the auth routes (sign-in and callback), and login silently fails.
- The redirect URI is derived from the incoming request origin (`<origin>/api/auth/callback`) and must be registered exactly on the Google OAuth client.
- Refresh tokens issued by a **Testing**-status OAuth app expire after 7 days; publish the app to Production for persistent login.

### App State & View Routing

`App.tsx` is the single state owner. There is no React Router — view switching is driven by a `ViewState` union type:

```
LOGIN → LOADING_DATA → SETUP (first-time user, no Profile sheet row) → DASHBOARD
```

All shared state (`AppState`) is held in `App.tsx` via `useState`:
- `currentUser: UserProfile | null`
- `logs: MealLog[]`
- `weightHistory: WeightLog[]`

The `SheetService` instance is stored in a `useRef`. `App` passes update callbacks (`onUpdateUser`, `onUpdateLogs`, `onUpdateWeight`) down to `Dashboard`, which use an **optimistic update pattern**: state updates immediately, then the async Sheet save fires in the background.

On a 401, `App` refreshes the access token via `/api/auth/token` and retries transparently. A manual "Reconnect" overlay exists only as a fallback.

### Services Layer

**`geminiService.ts`** — All AI interactions:
- `analyzeFood(image?, text)` — structured nutrition (foodName, calories, protein, carbs, fat, reasoning)
- `generatePlanFromProfile(profile)` — TDEE + macro targets
- `getDailyAdvice(profile, logs)` — contextual advice banner
- `getFoodSuggestion(remaining, goal, todayMeals)` — suggestions account for time of day, already-eaten meals, and a randomised format hint to avoid repeating the same foods

Model fallback chain: `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3.8-flash`. The lite models have the same free-tier quota (15 RPM / 500 RPD); the full Flash model is a 20-RPD last resort. Each call retries with exponential backoff (max 3) on 429/503/500; 401/403 are thrown immediately.

**`sheetService.ts`** — Google Sheets CRUD (class `SheetService`):
- `init()`: searches Drive for "NutriTrack AI Data", creates one with Profile/Logs/Weight sheets if not found
- `loadData()`: batch-reads all three sheets in one call
- `saveUser()`, `saveLogs()`, `saveWeight()`: overwrite-then-clear-remainder
- Logs stored chronologically, returned newest-first; weight sorted ascending

**`tokenStorage.ts`** — Access token in `localStorage`; `refreshTokenSilently()` fetches `/api/auth/token`; `logoutSession()` ends the server session.

**`storageService.ts`** — LocalStorage utilities, currently unused.

### Components

```
App.tsx                    # State owner, view router, token refresh, SheetService lifecycle
├── Login.tsx              # On mount: stored token → /api/auth/token → sign-in redirect to /api/auth/login
├── Layout.tsx             # Fixed header, sync status, profile menu, logout
│   └── Dashboard.tsx      # Main dashboard, ~5 modals inline
│   └── ProfileSetup.tsx   # First-time onboarding → AI plan generation
└── ErrorBoundary.tsx
worker/index.js            # Routes /api/auth/* to handlers, else serves static assets
functions/api/auth/*.js    # login, callback, token, logout (+ _shared.js helpers)
```

### Environment Variables

- **Build time**: `VITE_API_KEY` (Gemini). Injected into the client bundle by `vite.config.ts`.
- **Worker runtime**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (secret), KV binding `SESSIONS`.
- Local dev: `.env` for Vite (`API_KEY`), `.dev.vars` for Wrangler.
- `VITE_GOOGLE_CLIENT_ID` is no longer used by the client; the OAuth client secret stays server-side.

### Google Cloud Setup

- OAuth client type: **Web application**
- Authorized redirect URI: `https://<host>/api/auth/callback` (and `http://localhost:8788/api/auth/callback` for Wrangler)
- Scope: `https://www.googleapis.com/auth/drive.file` only
- Publishing status: **In production** (otherwise refresh tokens expire after 7 days)

### Timezone

All date/time functions in `utils/dateUtils.ts` use `Asia/Singapore` (UTC+8). Dates use `YYYY-MM-DD` (`en-CA`), times `HH:mm`. Hardcoded — change the IANA string to change timezone.

### Key Types (`types.ts`)

- `UserProfile` — TDEE, target macros, activity level, goal enum
- `MealLog` — date, time, meal type (Breakfast/Lunch/Dinner/Snack; legacy Chinese values migrated via `normalizeMealType`), description, macros, optional imageUrl
- `WeightLog` — date + weight
- `GoalType`: LOSE_WEIGHT, MAINTAIN, GAIN_MUSCLE
- `ActivityLevel`: SEDENTARY, LIGHTLY_ACTIVE, MODERATELY_ACTIVE, VERY_ACTIVE

### Image Handling

Food images are read as base64 data URLs client-side (FileReader) and sent inline to Gemini. The 5MB limit is enforced before reading. `imageUrl` is intentionally **excluded from Sheet sync** to avoid payload limits; images persist only for the session.

## Design System

See `DESIGN.md` for the full design spec. Key tokens:
- **Primary**: emerald (#10b981), deep (#047857), mint surface (#ecfdf5)
- **Macro colors**: Calories = emerald, Protein = blue (#3b82f6), Carbs = orange (#f97316), Fat = purple (#a855f7)
- **Deficit**: teal (#14b8a6)
- **AI features**: indigo (#4f46e5)
- **Canvas**: #f8fafc, Surface: #ffffff, Border: #e2e8f0
- **Typography**: Inter, headings 28-32px/800, metrics 28-40px/800, body 14-16px/400
- **Spacing scale**: 4, 8, 12, 16, 20, 24, 32, 48, 64
- **Touch targets**: 44px minimum
- Prefer rounded-xl/2xl cards, emerald health accent, avoid heavy glassmorphism and purple AI gradients
