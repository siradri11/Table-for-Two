# Table for Two

A cozy PWA for couples to share pantry inventory, favorite recipes, meal planning, and AI recipe suggestions.

## Features

- **Pantry** — Track items with quantity/units, tags (presets + custom colors), real-time sync
- **Recipes** — Photos, ingredients, step-by-step cooking mode, pantry sufficiency check, auto-deduct pantry after cooking
- **Plan** — Calendar of meals cooked, meal planner, aggregated shopping list
- **AI Chat** — Gemini-powered suggestions based on your pantry (via Supabase Edge Function)

## Setup

### 1. Environment

Create `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Supabase database

In the [Supabase SQL Editor](https://supabase.com/dashboard), run migrations in order:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_storage.sql`

Enable **Email** auth under Authentication → Providers.

### 3. Storage

The migration creates a public `recipe-images` bucket. If it fails, create the bucket manually in Storage and re-run the storage policies from `002_storage.sql`.

### 4. Gemini Edge Function (optional, for AI Chat)

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set GEMINI_API_KEY=your_google_ai_studio_api_key
npx supabase functions deploy gemini-chat
```

Get an API key from [Google AI Studio](https://aistudio.google.com).

### 5. Run locally

```bash
npm install
npm run dev
```

### 6. Install on phones (PWA)

- **Android Chrome:** Menu → Install app, or use the in-app banner
- **iOS Safari:** Share → Add to Home Screen

## Household pairing

1. First partner signs up and **Create new household** — share the invite code
2. Second partner signs up and **Join with invite code**

Both see the same pantry and recipes in real time.

## Build

```bash
npm run build
npm run preview
```

Deploy the `dist` folder to any static host (Vercel, Netlify, Cloudflare Pages) for free.
