import { supabase } from '../supabaseClient'

export async function fetchRecipe(id) {
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*, recipe_tags(tag_id)')
    .eq('id', id)
    .single()
  if (error) throw error
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

export async function saveBookmark(householdId, { name, sourceUrl, tagIds }) {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name: name.trim(),
      source_url: sourceUrl.trim(),
      is_bookmark: true,
      scraped_content: null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error

  if (tagIds?.length) {
    await supabase.from('recipe_tags').insert(tagIds.map((tag_id) => ({ recipe_id: data.id, tag_id })))
  }

  return data.id
}

export async function saveScrapedRecipe(householdId, { name, sourceUrl, scrapedContent, tagIds }) {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name: name.trim(),
      source_url: sourceUrl.trim(),
      scraped_content: scrapedContent,
      is_bookmark: false,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error

  if (tagIds?.length) {
    await supabase.from('recipe_tags').insert(tagIds.map((tag_id) => ({ recipe_id: data.id, tag_id })))
  }

  return data.id
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}

export async function scanRecipeUrl(url) {
  const { data, error } = await supabase.functions.invoke('scan-recipe', { body: { url } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export async function fetchDiaryMonth(householdId, startDate, endDate) {
  const { data, error } = await supabase
    .from('meal_diary')
    .select('*')
    .eq('household_id', householdId)
    .gte('diary_date', startDate)
    .lte('diary_date', endDate)
  if (error) throw error
  return data ?? []
}

export async function upsertDiaryEntry(householdId, diaryDate, mealType, content) {
  const { error } = await supabase.from('meal_diary').upsert(
    {
      household_id: householdId,
      diary_date: diaryDate,
      meal_type: mealType,
      content: content ?? '',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'household_id,diary_date,meal_type' },
  )
  if (error) throw error
}
