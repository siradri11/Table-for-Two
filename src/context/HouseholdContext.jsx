import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { HouseholdContext } from './householdContextValue'

export function HouseholdProvider({ user, children }) {
  const [household, setHousehold] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadHousehold = useCallback(async () => {
    if (!user) {
      setHousehold(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data: members, error: memErr } = await supabase
      .from('household_members')
      .select('household_id, households(*)')
      .eq('user_id', user.id)
      .limit(1)

    if (memErr) {
      setError(memErr.message)
      setHousehold(null)
    } else if (members?.[0]?.households) {
      setHousehold(members[0].households)
    } else {
      setHousehold(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    let active = true
    loadHousehold().then(() => {
      if (!active) return
    })
    return () => {
      active = false
    }
  }, [loadHousehold])

  const createHousehold = useCallback(async (name = 'Our Kitchen') => {
    const { data, error: fnErr } = await supabase.rpc('create_household', { p_name: name })
    if (fnErr) throw fnErr
    await loadHousehold()
    return data
  }, [loadHousehold])

  const joinHousehold = useCallback(async (code) => {
    const { data, error: fnErr } = await supabase.rpc('join_household', { p_invite_code: code })
    if (fnErr) throw fnErr
    await loadHousehold()
    return data
  }, [loadHousehold])

  const joinHouseholdWithMerge = useCallback(async (code, merge) => {
    const { data, error: fnErr } = await supabase.rpc('join_household_with_merge', {
      p_invite_code: code,
      p_merge: merge,
    })
    if (fnErr) throw fnErr
    await loadHousehold()
    return data
  }, [loadHousehold])

  const value = useMemo(
    () => ({
      household,
      householdId: household?.id ?? null,
      loading,
      error,
      refresh: loadHousehold,
      createHousehold,
      joinHousehold,
      joinHouseholdWithMerge,
    }),
    [household, loading, error, loadHousehold, createHousehold, joinHousehold, joinHouseholdWithMerge],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}
