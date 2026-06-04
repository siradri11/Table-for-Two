import { useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useRealtime(householdId, tables, onChange) {
  useEffect(() => {
    if (!householdId || !tables?.length) return

    const channel = supabase.channel(`household:${householdId}`)

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `household_id=eq.${householdId}`,
        },
        () => onChange?.(),
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, tables, onChange])
}
