import { supabase } from '../supabaseClient'

export async function fetchHouseholdMembers(householdId) {
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, joined_at')
    .eq('household_id', householdId)
    .order('joined_at')
  if (error) throw error
  return data ?? []
}

export async function fetchProfilesForUsers(userIds) {
  if (!userIds?.length) return []
  const { data, error } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds)
  if (error) throw error
  return data ?? []
}

export function buildDisplayNameMap(members, profiles) {
  const profileByUser = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p.display_name]))
  const map = {}
  ;(members ?? []).forEach((m, i) => {
    const name = profileByUser[m.user_id]?.trim()
    map[m.user_id] = name || `User ${i + 1}`
  })
  return map
}

export function getDisplayName(userId, displayNameMap) {
  if (!userId) return 'Unknown'
  return displayNameMap[userId] ?? 'Unknown'
}

export async function saveProfileDisplayName(userId, displayName) {
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    display_name: displayName?.trim() || null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function loadHouseholdDisplayNames(householdId) {
  const members = await fetchHouseholdMembers(householdId)
  const profiles = await fetchProfilesForUsers(members.map((m) => m.user_id))
  return { members, displayNameMap: buildDisplayNameMap(members, profiles) }
}
