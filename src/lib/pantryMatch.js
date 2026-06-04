export function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

export function findPantryItem(ingredient, pantryItems) {
  if (ingredient.pantry_item_id) {
    return pantryItems.find((p) => p.id === ingredient.pantry_item_id) ?? null
  }
  const key = normalizeName(ingredient.name)
  return (
    pantryItems.find((p) => normalizeName(p.name) === key) ??
    pantryItems.find((p) => normalizeName(p.name).includes(key) || key.includes(normalizeName(p.name))) ??
    null
  )
}

export function checkIngredient(ingredient, pantryItems) {
  const pantry = findPantryItem(ingredient, pantryItems)
  const needed = Number(ingredient.quantity) || 0
  const unit = ingredient.unit

  if (!pantry) {
    return {
      ok: false,
      name: ingredient.name,
      needed,
      unit,
      have: 0,
      haveUnit: unit,
      reason: 'missing',
    }
  }

  if (pantry.unit !== unit) {
    return {
      ok: false,
      name: ingredient.name,
      needed,
      unit,
      have: Number(pantry.quantity),
      haveUnit: pantry.unit,
      pantryItemId: pantry.id,
      reason: 'unit_mismatch',
    }
  }

  const have = Number(pantry.quantity)
  if (have < needed) {
    return {
      ok: false,
      name: ingredient.name,
      needed,
      unit,
      have,
      haveUnit: pantry.unit,
      pantryItemId: pantry.id,
      reason: 'insufficient',
    }
  }

  return {
    ok: true,
    name: ingredient.name,
    needed,
    unit,
    have,
    haveUnit: pantry.unit,
    pantryItemId: pantry.id,
  }
}

export function checkRecipeIngredients(ingredients, pantryItems) {
  const results = ingredients.map((ing) => checkIngredient(ing, pantryItems))
  const missing = results.filter((r) => !r.ok)
  return {
    canCook: missing.length === 0,
    results,
    missing,
  }
}

export function aggregatePlanIngredients(plannedRecipes) {
  const map = new Map()
  for (const { recipe, ingredients } of plannedRecipes) {
    for (const ing of ingredients) {
      const key = `${normalizeName(ing.name)}|${ing.unit}`
      const prev = map.get(key)
      if (prev) {
        prev.quantity += Number(ing.quantity) || 0
        prev.recipes.add(recipe.name)
      } else {
        map.set(key, {
          name: ing.name,
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit,
          recipes: new Set([recipe.name]),
        })
      }
    }
  }
  return [...map.values()].map((v) => ({
    ...v,
    recipes: [...v.recipes],
  }))
}
