import { getPublicUrl } from './storage'
import { supabase } from '../supabaseClient'

export function getRecipeCoverUrl(recipe) {
  if (!recipe) return null
  return getPublicUrl(recipe.cover_image_path) || recipe.cover_image_url || null
}

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

async function syncRecipeTags(recipeId, tagIds) {
  await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId)
  if (tagIds?.length) {
    await supabase.from('recipe_tags').insert(tagIds.map((tag_id) => ({ recipe_id: recipeId, tag_id })))
  }
}

export async function saveBookmark(householdId, { name, sourceUrl, tagIds, coverImagePath, coverImageUrl }) {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name: name.trim(),
      source_url: sourceUrl.trim(),
      is_bookmark: true,
      scraped_content: null,
      cover_image_path: coverImagePath ?? null,
      cover_image_url: coverImageUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error

  await syncRecipeTags(data.id, tagIds)
  return data.id
}

export async function saveScrapedRecipe(householdId, { name, sourceUrl, scrapedContent, tagIds, coverImagePath, coverImageUrl }) {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name: name.trim(),
      source_url: sourceUrl.trim(),
      scraped_content: scrapedContent,
      is_bookmark: false,
      cover_image_path: coverImagePath ?? null,
      cover_image_url: coverImageUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error

  await syncRecipeTags(data.id, tagIds)
  return data.id
}

export async function updateRecipe(id, {
  name,
  sourceUrl,
  scrapedContent,
  isBookmark,
  tagIds,
  coverImagePath,
  coverImageUrl,
}) {
  const payload = {
    name: name.trim(),
    source_url: sourceUrl?.trim() || null,
    scraped_content: isBookmark ? null : scrapedContent,
    is_bookmark: Boolean(isBookmark),
    cover_image_path: coverImagePath ?? null,
    cover_image_url: coverImageUrl ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('recipes').update(payload).eq('id', id)
  if (error) throw error

  await syncRecipeTags(id, tagIds)
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
