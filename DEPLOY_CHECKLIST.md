# Deploy checklist — Table for Two on your phone

Use this after pushing the latest code (includes `vercel.json` for routing).

**Database:** Run `supabase/migrations/003_improvements.sql` in Supabase SQL Editor if you have not already (profiles, shopping cart, low stock, chef, pantry photos).

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
- [ ] Recipes: open a recipe, refresh page — no 404
- [ ] Plan: calendar loads
- [ ] AI Chat: send or “Suggest from my pantry” works
