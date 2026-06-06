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
3. `supabase/migrations/003_improvements.sql`
4. `supabase/migrations/004_ux_improvements.sql`

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

## Deploy to Vercel (use on your phone)

No App Store needed — deploy once, open the HTTPS URL on each phone, then **Add to Home Screen**.

### 1. Push to GitHub

Ensure `main` is on GitHub (do not commit `.env.local`, `node_modules`, `dist`, or `supabase/.temp/`).

### 2. Import on Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import this repo.
2. Framework: **Vite** (auto-detected).
3. Build command: `npm run build` · Output: `dist`
4. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
   | `VITE_SUPABASE_ANON_KEY` | Same page (anon public key) |

5. Deploy. Copy your production URL (e.g. `https://table-for-two.vercel.app`).

SPA routing is handled by [vercel.json](vercel.json) so `/pantry`, `/recipes`, etc. work on refresh.

### 3. Supabase Auth URLs (required for phone login)

Supabase Dashboard → **Authentication** → **URL configuration**:

- **Site URL:** `https://YOUR-VERCEL-URL.vercel.app`
- **Redirect URLs:** add `https://YOUR-VERCEL-URL.vercel.app/**`

Replace with your real Vercel URL. Save, then sign in again on the phone if auth misbehaves.

### 4. Install on phones

| Platform | Steps |
|----------|--------|
| Android (Chrome) | Open your Vercel URL → menu **Install app** or in-app **Install** banner |
| iPhone (Safari) | Open URL → **Share** → **Add to Home Screen** |

Partner: same URL, her account → **Join with invite code**.

### 5. Verify after deploy

- [ ] Sign in on phone
- [ ] Add pantry item on phone → appears on PC (realtime)
- [ ] Refresh `/recipes` — no 404
- [ ] AI Chat sends a message
- [ ] Home screen icon opens full-screen app
