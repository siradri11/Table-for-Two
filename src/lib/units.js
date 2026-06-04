export const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'cup']

export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

export function formatQuantity(qty, unit) {
  const n = Number(qty)
  if (Number.isNaN(n)) return `0 ${unit}`
  const display = n % 1 === 0 ? n.toString() : n.toFixed(1)
  return `${display} ${unit}`
}
