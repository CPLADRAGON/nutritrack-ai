# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # TypeScript check + Vite production build to ./dist
npm run preview   # Serve the production build locally
```

No test suite, linter, or formatter is configured yet.

## Architecture

NutriTrack AI is a **serverless, client-only** React 18 + TypeScript + Vite app. There is no backend — all data lives in the user's own Google Drive via the Google Sheets API, and authentication is handled by Google OAuth.

### Tech Stack
- **Frontend**: React 18, TypeScript 5, Vite 5 — single-page app with no router
- **Styling**: Tailwind CSS (utility classes, glassmorphism touches, Inter font)
- **Charts**: Recharts (bar chart for calories, line chart for weight)
- **AI**: `@google/genai` (Gemini SDK) with structured JSON responses via schema constraints
- **Storage**: Google Sheets API v4 + Google Drive API v3 — spreadsheet auto-created in user's Drive
- **Auth**: Google Identity Services (OAuth 2.0 token-based, not Firebase)
- **Deployment**: GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)

### App State & View Routing

`App.tsx` is the single state owner. There is no React Router — view switching is driven by a `ViewState` union type:

```
LOGIN → LOADING_DATA → SETUP (first-time user, no Profile sheet row) → DASHBOARD
```

All shared state (`AppState`) is held in `App.tsx` via `useState`:
- `currentUser: UserProfile | null`
- `logs: MealLog[]`
- `weightHistory: WeightLog[]`

The `SheetService` instance is stored in a `useRef` and passed no props — instead, `App` passes update callbacks (`onUpdateUser`, `onUpdateLogs`, `onUpdateWeight`) down to `Dashboard`. Updates follow an **optimistic update pattern**: state is updated immediately, then the async Sheet save fires in the background.

### Services Layer

**`geminiService.ts`** — All AI interactions:
- `analyzeFood(image?, text)` — Analyzes food photo or text description, returns structured nutrition (foodName, calories, protein, carbs, fat, reasoning)
- `generatePlanFromProfile(profile)` — Calculates TDEE + macro targets from user body stats
- `getDailyAdvice(profile, logs)` — Contextual daily advice banner
- `getFoodSuggestion(remaining, goal)` — "What should I eat?" based on remaining macros

Model fallback chain: `gemini-3.1-flash-lite` → `gemini-2.5-flash-lite` → `gemini-2.5-flash`. Each call also has exponential-backoff retry (max 3 retries) for 429/503/500 errors. Auth errors (401/403) are thrown immediately without retry.

**`sheetService.ts`** — Google Sheets CRUD (class `SheetService`):
- On `init()`: searches Drive for a spreadsheet named "NutriTrack AI Data", creates one with Profile/Logs/Weight sheets if not found
- `loadData()`: batch-reads all three sheets in one API call
- `saveUser()`, `saveLogs()`, `saveWeight()`: overwrite-then-clear-remainder strategy to handle shrinking data
- Logs are stored chronologically; returned reversed (newest first) for the UI
- Weight history is sorted ascending by date

**`storageService.ts`** — LocalStorage utilities keyed by `nutritrack_<type>_<username>`. Currently defined but not used in the main app flow (Sheet sync is the primary path).

### Components

```
App.tsx                    # State owner, view router, SheetService lifecycle
├── Login.tsx              # Google OAuth login, troubleshooting help inline
├── Layout.tsx             # Fixed header (logo, sync status, profile dropdown, logout), main content area, footer
│   └── Dashboard.tsx      # Main dashboard — ~1150 lines, contains all modals inline
│   └── ProfileSetup.tsx   # First-time onboarding form → AI plan generation
└── ErrorBoundary.tsx      # Class-based error boundary with reload button
```

`Dashboard.tsx` is the largest file and contains 5 modal dialogs inline (Log Meal, Edit Goals, Update Weight, Update TDEE, Delete Confirmation). The Log Meal modal includes both AI photo/description analysis and manual entry. Escape key closes all modals via a single keyboard listener.

### Timezone

All date/time functions in `utils/dateUtils.ts` use `Asia/Singapore` (UTC+8) via `Intl.DateTimeFormat`. Dates use `YYYY-MM-DD` format (`en-CA` locale), times use `HH:mm` 24-hour format. This is hardcoded — changing timezone requires updating the IANA string in dateUtils.ts.

### Key Types (`types.ts`)

- `UserProfile` — includes TDEE, target macros, activity level, goal enum
- `MealLog` — date, time, meal type (Breakfast/Lunch/Dinner/Snack in Chinese), description, macros, optional imageUrl
- `WeightLog` — date + weight
- `GoalType` enum: LOSE_WEIGHT, MAINTAIN, GAIN_MUSCLE
- `ActivityLevel` enum: SEDENTARY, LIGHTLY_ACTIVE, MODERATELY_ACTIVE, VERY_ACTIVE

### Environment Variables

Two env vars are injected at build time via Vite's `define` in `vite.config.ts`:
- `VITE_API_KEY` — Gemini API key
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth client ID

For local dev, create a `.env` file with `API_KEY=...` and `GOOGLE_CLIENT_ID=...`. Vite loads both `VITE_`-prefixed and plain versions.

### Image Handling

Food images are read as base64 data URLs client-side (FileReader) and sent inline to Gemini. The 5MB size limit is enforced before reading. The `imageUrl` field on `MealLog` is intentionally **excluded from Sheet sync** to avoid hitting Google Sheets API payload limits — images only persist in local state for the session.

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
