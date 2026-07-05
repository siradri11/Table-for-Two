import { normalizeName } from './pantryMatch'

export function findPantryByName(pantryItems, name) {
  const key = normalizeName(name)
  return pantryItems.find((p) => normalizeName(p.name) === key) ?? null
}

export function findUnitConflicts(checkedItems, pantryItems) {
  const conflicts = []
  for (const cartItem of checkedItems) {
    const pantryItem = cartItem.pantry_item_id
      ? pantryItems.find((p) => p.id === cartItem.pantry_item_id)
      : findPantryByName(pantryItems, cartItem.name)

    if (pantryItem && pantryItem.unit !== cartItem.unit) {
      conflicts.push({ cartItem, pantryItem })
    }
  }
  return conflicts
}
