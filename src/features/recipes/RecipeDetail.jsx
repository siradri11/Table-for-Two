import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { checkRecipeIngredients } from '../../lib/pantryMatch'
import { fetchRecipe, fetchPantry, getLastCooked } from '../../lib/recipes'
import { getPublicUrl } from '../../lib/storage'
import { formatQuantity } from '../../lib/units'
import { supabase } from '../../supabaseClient'
import './RecipeDetail.css'

export function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const [recipe, setRecipe] = useState(null)
  const [tags, setTags] = useState([])
  const [lastCooked, setLastCooked] = useState(null)
  const [showMissing, setShowMissing] = useState(false)
  const [check, setCheck] = useState(null)

  const load = useCallback(async () => {
    if (!id || !householdId) return
    const [r, p, t, lc] = await Promise.all([
      fetchRecipe(id),
      fetchPantry(householdId),
      supabase.from('tags').select('*').eq('household_id', householdId).eq('category', 'recipe'),
      getLastCooked(id),
    ])
    setRecipe(r)
    if (!t.error) setTags(t.data ?? [])
    setLastCooked(lc)
    setCheck(checkRecipeIngredients(r.recipe_ingredients ?? [], p))
  }, [id, householdId])

  useEffect(() => {
    load()
  }, [load])

  if (!recipe) return <p className="empty-state">Loading…</p>

  const cover = getPublicUrl(recipe.cover_image_path)
  const tagIds = recipe.recipe_tags?.map((t) => t.tag_id) ?? []
  const rTags = tags.filter((t) => tagIds.includes(t.id))

  const missingMessage = (m) => {
    const prefix = m.name ? `${m.name} — ` : ''
    if (m.reason === 'missing') return `${prefix}need ${formatQuantity(m.needed, m.unit)} — not in pantry`
    if (m.reason === 'unit_mismatch') {
      return `${prefix}need ${formatQuantity(m.needed, m.unit)} — pantry has ${formatQuantity(m.have, m.haveUnit)} (different unit)`
    }
    return `${prefix}need ${formatQuantity(m.needed, m.unit)} — have ${formatQuantity(m.have, m.unit)}`
  }

  return (
    <div className="recipe-detail">
      {cover && <img src={cover} alt={recipe.name} className="recipe-detail__hero" />}
      <div className="card">
        <h2>{recipe.name}</h2>
        {lastCooked && (
          <p className="recipe-detail__last">Last cooked: {new Date(lastCooked).toLocaleDateString()}</p>
        )}
        <div className="recipe-detail__tags">
          {rTags.map((t) => <TagChip key={t.id} tag={t} small />)}
        </div>
        {recipe.description && <p className="recipe-detail__desc">{recipe.description}</p>}
      </div>

      <div
        className={`recipe-detail__banner ${check?.canCook ? 'recipe-detail__banner--ok' : 'recipe-detail__banner--warn'}`}
        onClick={() => !check?.canCook && setShowMissing(true)}
        role={!check?.canCook ? 'button' : undefined}
      >
        {check?.canCook
          ? '✓ You have enough ingredients to cook this!'
          : 'Some ingredients are missing — tap to see what you need'}
      </div>

      <div className="card">
        <h3>Ingredients</h3>
        <ul className="recipe-detail__ingredients">
          {(recipe.recipe_ingredients ?? []).map((ing) => (
            <li key={ing.id}>
              {ing.name} — {formatQuantity(ing.quantity, ing.unit)}
            </li>
          ))}
        </ul>
      </div>

      <div className="recipe-detail__actions">
        <Button fullWidth onClick={() => navigate(`/recipes/${id}/cook`)}>
          I&apos;m cooking this!
        </Button>
        <Link to={`/recipes/${id}/edit`}>
          <Button variant="secondary" fullWidth>Edit recipe</Button>
        </Link>
      </div>

      <Modal open={showMissing} onClose={() => setShowMissing(false)} title="Missing ingredients">
        <ul className="recipe-detail__missing-list">
          {check?.missing.map((m, i) => (
            <li key={i}>{missingMessage(m)}</li>
          ))}
        </ul>
      </Modal>
    </div>
  )
}
