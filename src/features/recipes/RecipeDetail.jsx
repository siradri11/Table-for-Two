import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { RecipeContent } from '../../components/RecipeContent'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { deleteRecipe, fetchRecipe, getRecipeCoverUrl } from '../../lib/recipes'
import { supabase } from '../../supabaseClient'
import './RecipeDetail.css'

export function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const [recipe, setRecipe] = useState(null)
  const [tags, setTags] = useState([])

  const load = useCallback(async () => {
    if (!id || !householdId) return
    const [r, t] = await Promise.all([
      fetchRecipe(id),
      supabase.from('tags').select('*').eq('household_id', householdId).eq('category', 'recipe'),
    ])
    setRecipe(r)
    if (!t.error) setTags(t.data ?? [])
  }, [id, householdId])

  useEffect(() => {
    load()
  }, [load])

  if (!recipe) return <p className="empty-state">Loading…</p>

  const tagIds = recipe.recipe_tags?.map((t) => t.tag_id) ?? []
  const rTags = tags.filter((t) => tagIds.includes(t.id))
  const isBookmark = recipe.is_bookmark || !recipe.scraped_content
  const cover = getRecipeCoverUrl(recipe)

  const openLink = () => {
    if (recipe.source_url) window.open(recipe.source_url, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = async () => {
    if (!confirm('Remove this recipe?')) return
    await deleteRecipe(id)
    navigate('/recipes')
  }

  return (
    <div className="recipe-detail">
      {cover && <img src={cover} alt="" className="recipe-detail__hero" />}
      <div className="card">
        <h2>{recipe.name}</h2>
        {isBookmark && <span className="recipe-detail__badge">Bookmark</span>}
        <div className="recipe-detail__tags">
          {rTags.map((t) => <TagChip key={t.id} tag={t} small />)}
        </div>
      </div>

      {recipe.scraped_content && !recipe.is_bookmark && (
        <div className="card recipe-detail__content">
          <RecipeContent content={recipe.scraped_content} />
        </div>
      )}

      {isBookmark && (
        <p className="recipe-detail__hint">This is a saved link. Open it in your browser when you are ready to cook.</p>
      )}

      <div className="recipe-detail__actions">
        <Button fullWidth onClick={() => navigate(`/recipes/${id}/edit`)}>
          Edit
        </Button>
        {recipe.source_url && (
          <Button variant="secondary" fullWidth onClick={openLink}>
            Open recipe in browser
          </Button>
        )}
        <Button variant="secondary" fullWidth onClick={handleDelete}>
          Remove
        </Button>
        <Button variant="ghost" fullWidth onClick={() => navigate('/recipes')}>
          Back to recipes
        </Button>
      </div>
    </div>
  )
}
