import { supabase } from '../supabaseClient'

export async function fetchPantry(householdId) {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('household_id', householdId)
    .order('name')
  if (error) throw error
  return data ?? []
}
