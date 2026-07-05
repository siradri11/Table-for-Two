# Deploy checklist — Table for Two on your phone

Use this after pushing the latest code (includes `vercel.json` for routing).

**Database:** Run migrations in order through `005_concept_overhaul.sql` (URL recipes, meal diary, simplified merge).

**Edge functions:** Deploy `gemini-chat` (optional) and `scan-recipe` (for recipe URL scanning).

## Vercel deploy

- [ ] Repo pushed to GitHub (`main`)
- [ ] Vercel project created and linked to the repo
- [ ] Env vars set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] Production deploy succeeded
- [ ] Production URL copied: `https://________________.vercel.app`

## Supabase Auth (replace with your Vercel URL)

Dashboard → **Authentication** → **URL configuration**

- [ ] **Site URL** = `https://________________.vercel.app`
- [ ] **Redirect URLs** includes `https://________________.vercel.app/**`

## Phone install (both devices)

- [ ] Open production URL in phone browser (HTTPS, not localhost)
- [ ] Sign up / sign in works
- [ ] Partner joined household via invite code (if applicable)
- [ ] **Android:** Install app / Add to Home Screen
- [ ] **iPhone:** Safari → Share → Add to Home Screen
- [ ] Home screen icon opens app full-screen

## Verify

- [ ] Pantry: add item on phone → shows on other device
- [ ] Cart: check item → Save to pantry
- [ ] Recipes: add bookmark or scan URL
- [ ] Plan: tap day → diary notes save
- [ ] Refresh page — no 404
- [ ] AI Chat: send or “Suggest from my pantry” works
