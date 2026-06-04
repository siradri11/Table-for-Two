/**
 * Fails production builds when Supabase env vars are missing.
 * Uses Vite loadEnv so .env.local works locally; Vercel injects vars into process.env.
 */
import { loadEnv } from 'vite'

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production'
const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
const ok = Boolean(url && key && String(url).startsWith('https://'))

if (!ok) {
  console.error(
    '\n[Table for Two] Missing or invalid build environment variables:\n' +
      '  VITE_SUPABASE_URL (must start with https://)\n' +
      '  VITE_SUPABASE_ANON_KEY\n' +
      'Set them in Vercel → Settings → Environment Variables → Production, then redeploy.\n',
  )
  process.exit(1)
}

console.log('[Table for Two] Supabase env vars present for build.')
