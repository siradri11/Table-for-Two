import { supabase } from '../supabaseClient'

export async function fetchRecipe(id) {
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*, recipe_tags(tag_id), recipe_ingredients(*), recipe_steps(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  if (recipe.recipe_steps) {
    recipe.recipe_steps.sort((a, b) => a.step_number - b.step_number)
  }
  if (recipe.recipe_ingredients) {
    recipe.recipe_ingredients.sort((a, b) => a.sort_order - b.sort_order)
  }
  return recipe
}

export async function fetchRecipes(householdId) {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_tags(tag_id)')
    .eq('household_id', householdId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchPantry(householdId) {
  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('household_id', householdId)
  if (error) throw error
  return data ?? []
}

export async function saveRecipe(householdId, form, recipeId) {
  const payload = {
    household_id: householdId,
    name: form.name.trim(),
    description: form.description?.trim() || null,
    cover_image_path: form.cover_image_path || null,
    updated_at: new Date().toISOString(),
  }

  let id = recipeId
  if (recipeId) {
    const { error } = await supabase.from('recipes').update(payload).eq('id', recipeId)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('recipes').insert(payload).select('id').single()
    if (error) throw error
    id = data.id
  }

  await supabase.from('recipe_tags').delete().eq('recipe_id', id)
  if (form.tagIds?.length) {
    await supabase.from('recipe_tags').insert(form.tagIds.map((tag_id) => ({ recipe_id: id, tag_id })))
  }

  await supabase.from('recipe_ingredients').delete().eq('recipe_id', id)
  if (form.ingredients?.length) {
    await supabase.from('recipe_ingredients').insert(
      form.ingredients.map((ing, i) => ({
        recipe_id: id,
        name: ing.name.trim(),
        quantity: Number(ing.quantity) || 0,
        unit: ing.unit,
        sort_order: i,
        pantry_item_id: ing.pantry_item_id || null,
      })),
    )
  }

  await supabase.from('recipe_steps').delete().eq('recipe_id', id)
  if (form.steps?.length) {
    await supabase.from('recipe_steps').insert(
      form.steps.map((step, i) => ({
        recipe_id: id,
        step_number: i + 1,
        instruction: step.instruction.trim(),
        image_path: step.image_path || null,
      })),
    )
  }

  return id
}

export async function completeCooking(householdId, recipeId, userId, { mealType, notes, usage }) {
  const { data: log, error: logErr } = await supabase
    .from('cook_logs')
    .insert({
      household_id: householdId,
      recipe_id: recipeId,
      meal_type: mealType,
      notes: notes || null,
      created_by: userId,
    })
    .select('id')
    .single()
  if (logErr) throw logErr

  if (usage?.length) {
    await supabase.from('cook_log_ingredient_usage').insert(
      usage.map((u) => ({
        cook_log_id: log.id,
        pantry_item_id: u.pantry_item_id || null,
        name: u.name,
        quantity_used: Number(u.quantity_used) || 0,
        unit: u.unit,
      })),
    )

    for (const u of usage) {
      if (!u.pantry_item_id) continue
      const { data: item } = await supabase.from('pantry_items').select('quantity').eq('id', u.pantry_item_id).single()
      if (item) {
        const next = Math.max(0, Number(item.quantity) - Number(u.quantity_used))
        await supabase.from('pantry_items').update({ quantity: next, updated_at: new Date().toISOString() }).eq('id', u.pantry_item_id)
      }
    }
  }

  return log
}

export async function getLastCooked(recipeId) {
  const { data } = await supabase
    .from('cook_logs')
    .select('cooked_at')
    .eq('recipe_id', recipeId)
    .order('cooked_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.cooked_at ?? null
}
