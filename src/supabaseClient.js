import { createClient } from '@supabase/supabase-js'
import { getEnvConfig } from './lib/envConfig'

const { supabaseUrl, supabaseAnonKey, ok } = getEnvConfig()

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = ok ? createClient(supabaseUrl, supabaseAnonKey) : null

export const isSupabaseConfigured = ok