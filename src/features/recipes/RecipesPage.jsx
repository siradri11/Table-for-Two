import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { useRealtime } from '../../hooks/useRealtime'
import { getPublicUrl } from '../../lib/storage'
import { fetchRecipes } from '../../lib/recipes'
import { supabase } from '../../supabaseClient'
import './RecipesPage.css'

export function RecipesPage() {
  const { householdId } = useHousehold()
  const [recipes, setRecipes] = useState([])
  const [tags, setTags] = useState([])
  const [filterTag, setFilterTag] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!householdId) return
    const [r, t] = await Promise.all([
      fetchRecipes(householdId),
      supabase.from('tags').select('*').eq('household_id', householdId).eq('category', 'recipe'),
    ])
    setRecipes(r)
    if (!t.error) setTags(t.data ?? [])
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtime(householdId, ['recipes'], load)

  const recipeTags = tags
  const filtered = recipes.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    if (!filterTag) return true
    return r.recipe_tags?.some((rt) => rt.tag_id === filterTag)
  })

  return (
    <div className="recipes-page">
      <div className="recipes-page__actions">
        <input
          type="search"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="recipes-page__search"
        />
        <Link to="/recipes/new"><Button>+ Add recipe</Button></Link>
        <Link to="/pantry/tags?category=recipe" className="recipes-page__tags-link">Manage tags</Link>
      </div>
      <div className="recipes-page__filters">
        <TagChip tag={{ name: 'All', color: '#ebe6df' }} selected={!filterTag} onClick={() => setFilterTag(null)} small />
        {recipeTags.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            selected={filterTag === tag.id}
            onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
            small
          />
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="empty-state">No recipes yet. Save one you loved!</p>
      ) : (
        <ul className="recipe-grid">
          {filtered.map((recipe) => {
            const tagIds = recipe.recipe_tags?.map((t) => t.tag_id) ?? []
            const rTags = recipeTags.filter((t) => tagIds.includes(t.id))
            const cover = getPublicUrl(recipe.cover_image_path)
            return (
              <li key={recipe.id}>
                <Link to={`/recipes/${recipe.id}`} className="card recipe-card">
                  {cover ? <img src={cover} alt="" className="recipe-card__img" /> : <div className="recipe-card__placeholder">🍽️</div>}
                  <div className="recipe-card__body">
                    <strong>{recipe.name}</strong>
                    {recipe.is_bookmark && <span className="recipe-card__badge">Link</span>}
                    {!recipe.is_bookmark && recipe.scraped_content && (
                      <span className="recipe-card__badge recipe-card__badge--saved">Saved</span>
                    )}
                    <div className="recipe-card__tags">
                      {rTags.map((t) => <TagChip key={t.id} tag={t} small />)}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
