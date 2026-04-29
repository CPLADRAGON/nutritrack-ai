# NutriTrack AI DESIGN.md

Design system for NutriTrack AI, adapted from the Mintlify-style clean green SaaS aesthetic and tuned for a friendly nutrition dashboard.

## 1. Visual Theme & Atmosphere

NutriTrack AI should feel like a calm, intelligent health companion: clean, bright, trustworthy, and easy to scan at a glance.

- Mood: fresh, optimistic, lightweight, health-focused
- Density: medium — dashboard data should be compact but not crowded
- Style: modern SaaS dashboard with soft nutrition-app warmth
- Avoid: heavy glassmorphism, generic purple AI gradients, cramped tables, excessive shadows
- Signature feel: emerald health accent, pill controls, rounded nutrition cards, clear macro progress surfaces

## 2. Color Palette & Roles

### Brand

| Token | Hex | Usage |
|---|---:|---|
| Primary Emerald | #10b981 | Primary CTAs, active states, calorie progress, brand accents |
| Primary Deep | #047857 | Hover/pressed emerald states |
| Mint Surface | #ecfdf5 | Light success/health surfaces |
| Secondary Blue | #3b82f6 | Protein chart/card accents, secondary actions |
| Indigo AI | #4f46e5 | AI insight panels and Gemini actions |

### Macro Colors

| Token | Hex | Usage |
|---|---:|---|
| Calories | #10b981 | Calories cards/progress |
| Protein | #3b82f6 | Protein card/progress |
| Carbs | #f97316 | Carbs card/progress |
| Fat | #a855f7 | Fat card/progress |
| Deficit | #14b8a6 | TDEE/deficit card |

### Neutrals

| Token | Hex | Usage |
|---|---:|---|
| Canvas | #f8fafc | Page background |
| Surface | #ffffff | Cards, modals, panels |
| Surface Soft | #f1f5f9 | Secondary panels, table section backgrounds |
| Border | #e2e8f0 | Hairlines and card outlines |
| Text Strong | #0f172a | Headings and key stats |
| Text Body | #334155 | Body copy |
| Text Muted | #64748b | Labels, metadata, helper text |
| Danger | #ef4444 | Deletion, over-target alerts |
| Warning Surface | #fff7ed | Soft warning panels |

## 3. Typography Rules

Use Inter for now because the existing app already relies on it. The look should be precise and clean rather than decorative.

| Role | Size | Weight | Line Height | Usage |
|---|---:|---:|---:|---|
| Page Title | 28-32px | 800 | 1.1 | Dashboard title / key page headers |
| Section Title | 18-22px | 700 | 1.25 | Card group headings |
| Card Title | 14-16px | 700 | 1.25 | Stat card labels, modal titles |
| Metric Number | 28-40px | 800 | 1.0 | Calories/macros/TDEE values |
| Body | 14-16px | 400 | 1.5 | Descriptions and paragraphs |
| Label | 12-13px | 700 | 1.3 | Uppercase stat labels and table headers |
| Micro | 11-12px | 600 | 1.3 | Pills, badges, metadata |

## 4. Component Styling

### Buttons

- Primary: emerald background, white text, rounded-full or rounded-xl, 44px minimum height
- Secondary: white background, slate border, slate text, rounded-xl
- AI action: indigo background with subtle glow, reserved for Gemini-powered actions
- Destructive: red background only inside confirmation flows
- Hover: slight translateY(-1px) or scale(1.02), not exaggerated
- Disabled: 60% opacity, no transform

### Cards

- Default card: white surface, 1px border, 16-24px radius, subtle shadow
- Stat card: large numeric value, small uppercase label, macro-colored progress strip
- Featured AI card: soft indigo/mint gradient surface, rounded-3xl, clear action button
- Food/meal card: compact row/card hybrid, optional image thumbnail, macro chips
- Avoid: dense spreadsheet-like tables on mobile

### Inputs & Forms

- Inputs: white or slate-50 surface, 1px border, 12px radius, 42-48px height
- Focus: 2px emerald/indigo focus ring depending on context
- Numeric inputs: explicit min/max/step values where possible
- Modals: rounded-2xl, strong title, form grouped into clear sections

### Charts

- Keep chart surfaces flat and bright
- Use macro color tokens consistently
- Tooltips: white card, rounded-xl, readable 13-14px text
- Prefer chart summaries above charts for quick scan

## 5. Layout Principles

### Dashboard Layout

Use a top-down health cockpit:

1. Header: app brand, user, logout
2. Hero Summary: today’s calories, deficit, streak/weight signal, primary log button
3. Macro Ring/Grid: calories/protein/carbs/fat as compact progress cards
4. AI Nutritionist: contextual recommendation card
5. Trends: calories and weight charts in two cards
6. Journal: responsive meal list, table on desktop, cards on mobile

### Spacing

Base scale: 4, 8, 12, 16, 20, 24, 32, 48, 64.

- Page padding: 16px mobile, 24-32px desktop
- Section gap: 24-32px
- Card padding: 20-24px
- Modal padding: 20-32px

## 6. Depth & Elevation

| Level | Usage |
|---|---|
| Flat | Page canvas, large background sections |
| Border only | Most dashboard cards |
| Soft shadow | Interactive cards, modals |
| Raised | Floating action button, confirmation dialogs |

Use shadows sparingly. The main hierarchy should come from spacing, borders, and color surfaces.

## 7. Responsive Behavior

### Mobile

- Replace daily journal table with meal cards
- Keep log meal action as a bottom-right FAB or sticky bottom CTA
- Stat cards should be 2-column or stacked depending width
- Modal content should use full-width bottom sheet style where possible
- Touch targets: 44px minimum

### Tablet/Desktop

- 4 macro cards in one row when possible
- Charts in 2-column grid
- Journal can use a table or grouped day sections
- Summary hero should include key daily status and quick actions

## 8. Do's and Don'ts

### Do

- Use emerald as the health signal
- Keep nutrition data visually scannable
- Use macro colors consistently
- Make AI features helpful but visually secondary to tracking
- Prefer rounded cards and pill controls
- Show over-target states with icon + text, not color alone

### Don't

- Overuse gradients
- Use dark mode as default for a health tracker
- Make every card glassy or blurry
- Hide critical data inside charts only
- Rely on color alone for warnings
- Use tiny chart tooltips or low-contrast muted text

## 9. Agent Prompt Guide

When modifying the UI, follow this prompt:

"Update NutriTrack AI using the project DESIGN.md. Use a clean Mintlify-inspired green SaaS dashboard style adapted for nutrition tracking: emerald accent, white cards, rounded-xl/2xl surfaces, macro-colored progress cards, responsive meal cards on mobile, and clear accessible controls. Keep the app bright, calm, and health-focused. Avoid generic purple AI gradients and heavy glassmorphism."
