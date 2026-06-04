import { useContext } from 'react'
import { HouseholdContext } from '../context/householdContextValue'

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider')
  return ctx
}
