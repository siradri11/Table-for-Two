export function getEnvConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const ok = Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      typeof supabaseUrl === 'string' &&
      supabaseUrl.startsWith('https://'),
  )

  return { supabaseUrl, supabaseAnonKey, ok }
}
