import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { fetchRecipe, fetchPantry, saveRecipe } from '../../lib/recipes'
import { getPublicUrl, uploadImage } from '../../lib/storage'
import { UNITS } from '../../lib/units'
import { supabase } from '../../supabaseClient'
import './RecipeForm.css'

const emptyIng = () => ({ name: '', quantity: '', unit: 'g', pantry_item_id: null })
const emptyStep = () => ({ instruction: '', image_path: null, imageFile: null })

export function RecipeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = location.state?.returnTo
  const cookState = location.state?.cookState
  const { householdId } = useHousehold()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverPath, setCoverPath] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [ingredients, setIngredients] = useState([emptyIng()])
  const [preparation, setPreparation] = useState([emptyStep()])
  const [steps, setSteps] = useState([emptyStep()])
  const [tagIds, setTagIds] = useState([])
  const [tags, setTags] = useState([])
  const [pantry, setPantry] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const goBack = () => {
    if (returnTo) {
      navigate(returnTo, { state: { cookState } })
    } else {
      navigate(isEdit ? `/recipes/${id}` : '/recipes')
    }
  }

  useEffect(() => {
    if (!householdId) return
    supabase.from('tags').select('*').eq('household_id', householdId).eq('category', 'recipe').then(({ data }) => setTags(data ?? []))
    fetchPantry(householdId).then(setPantry)
    if (isEdit) {
      fetchRecipe(id).then((r) => {
        setName(r.name)
        setDescription(r.description || '')
        setCoverPath(r.cover_image_path)
        setTagIds(r.recipe_tags?.map((t) => t.tag_id) ?? [])
        setIngredients(
          r.recipe_ingredients?.length
            ? r.recipe_ingredients.map((i) => ({
                name: i.name,
                quantity: String(i.quantity),
                unit: i.unit,
                pantry_item_id: i.pantry_item_id,
              }))
            : [emptyIng()],
        )
        setPreparation(
          r.recipe_preparation_steps?.length
            ? r.recipe_preparation_steps.map((s) => ({ instruction: s.instruction, image_path: s.image_path, imageFile: null }))
            : [emptyStep()],
        )
        setSteps(
          r.recipe_steps?.length
            ? r.recipe_steps.map((s) => ({ instruction: s.instruction, image_path: s.image_path, imageFile: null }))
            : [emptyStep()],
        )
      })
    }
  }, [householdId, id, isEdit])

  const toggleTag = (tid) => setTagIds((p) => (p.includes(tid) ? p.filter((t) => t !== tid) : [...p, tid]))

  const uploadSteps = async (items, folder) => {
    const result = []
    for (const step of items) {
      let image_path = step.image_path
      if (step.imageFile) {
        image_path = await uploadImage(householdId, step.imageFile, folder)
      }
      result.push({ instruction: step.instruction, image_path })
    }
    return result
  }

  const save = async (e) => {
    e.preventDefault()
    if (!householdId || !name.trim()) return
    setLoading(true)
    setError('')
    try {
      let cover_image_path = coverPath
      if (coverFile) {
        cover_image_path = await uploadImage(householdId, coverFile, 'covers')
      }
      const prepWithImages = await uploadSteps(preparation, 'steps')
      const stepsWithImages = await uploadSteps(steps, 'steps')
      const recipeId = await saveRecipe(
        householdId,
        {
          name,
          description,
          cover_image_path,
          tagIds,
          ingredients,
          preparation: prepWithImages,
          steps: stepsWithImages,
        },
        isEdit ? id : null,
      )
      if (returnTo) {
        navigate(returnTo, { state: { cookState } })
      } else {
        navigate(`/recipes/${recipeId}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const coverPreview = coverFile ? URL.createObjectURL(coverFile) : getPublicUrl(coverPath)

  const renderStepBlock = (items, setItems, label) =>
    items.map((step, i) => (
      <div key={i} className="recipe-form__row-block">
        <label>{label} {i + 1}</label>
        <textarea
          value={step.instruction}
          onChange={(e) => {
            const next = [...items]
            next[i] = { ...next[i], instruction: e.target.value }
            setItems(next)
          }}
          rows={3}
          placeholder="Optional"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const next = [...items]
            next[i] = { ...next[i], imageFile: e.target.files?.[0] ?? null }
            setItems(next)
          }}
        />
        {(step.imageFile || step.image_path) && (
          <img
            src={step.imageFile ? URL.createObjectURL(step.imageFile) : getPublicUrl(step.image_path)}
            alt=""
            className="recipe-form__step-img"
          />
        )}
        {items.length > 1 && (
          <button type="button" className="link-btn danger" onClick={() => setItems(items.filter((_, j) => j !== i))}>
            Remove
          </button>
        )}
      </div>
    ))

  return (
    <form className="recipe-form" onSubmit={save}>
      <h2>{isEdit ? 'Edit recipe' : 'New recipe'}</h2>
      {error && <p className="form-error">{error}</p>}
      <div className="card">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Cover photo (optional)
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
        </label>
        {coverPreview && <img src={coverPreview} alt="" className="recipe-form__preview" />}
        <label>
          Description (optional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <fieldset>
          <legend>Recipe tags</legend>
          <div className="recipe-form__tags">
            {tags.map((t) => (
              <TagChip key={t.id} tag={t} selected={tagIds.includes(t.id)} onClick={() => toggleTag(t.id)} />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="card">
        <h3>Ingredients (optional)</h3>
        {ingredients.map((ing, i) => (
          <div key={i} className="recipe-form__row-block">
            <input
              placeholder="Ingredient name"
              value={ing.name}
              onChange={(e) => {
                const next = [...ingredients]
                next[i] = { ...next[i], name: e.target.value }
                setIngredients(next)
              }}
              list="pantry-names"
            />
            <datalist id="pantry-names">
              {pantry.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <div className="recipe-form__row">
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={ing.quantity}
                onChange={(e) => {
                  const next = [...ingredients]
                  next[i] = { ...next[i], quantity: e.target.value }
                  setIngredients(next)
                }}
              />
              <select
                value={ing.unit}
                onChange={(e) => {
                  const next = [...ingredients]
                  next[i] = { ...next[i], unit: e.target.value }
                  setIngredients(next)
                }}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <select
              value={ing.pantry_item_id || ''}
              onChange={(e) => {
                const next = [...ingredients]
                const pid = e.target.value || null
                const p = pantry.find((x) => x.id === pid)
                next[i] = { ...next[i], pantry_item_id: pid, name: p ? p.name : next[i].name }
                setIngredients(next)
              }}
            >
              <option value="">Link to pantry (optional)</option>
              {pantry.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {ingredients.length > 1 && (
              <button type="button" className="link-btn danger" onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}>
                Remove
              </button>
            )}
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setIngredients([...ingredients, emptyIng()])}>
          + Add ingredient
        </Button>
      </div>

      <div className="card">
        <h3>Preparation (optional)</h3>
        {renderStepBlock(preparation, setPreparation, 'Prep')}
        <Button type="button" variant="ghost" onClick={() => setPreparation([...preparation, emptyStep()])}>
          + Add preparation step
        </Button>
      </div>

      <div className="card">
        <h3>Steps (optional)</h3>
        {renderStepBlock(steps, setSteps, 'Step')}
        <Button type="button" variant="ghost" onClick={() => setSteps([...steps, emptyStep()])}>
          + Add step
        </Button>
      </div>

      <Button type="submit" fullWidth disabled={loading}>{loading ? 'Saving…' : 'Save recipe'}</Button>
      <Button type="button" variant="ghost" fullWidth onClick={goBack}>
        {returnTo ? 'Back to cooking' : 'Cancel'}
      </Button>
    </form>
  )
}
