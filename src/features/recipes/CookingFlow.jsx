import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useHousehold } from '../../hooks/useHousehold'
import { useAuth } from '../../hooks/useAuth'
import { findPantryItem } from '../../lib/pantryMatch'
import { completeCooking, fetchRecipe, fetchPantry } from '../../lib/recipes'
import { getPublicUrl } from '../../lib/storage'
import { MEAL_TYPES, UNITS } from '../../lib/units'
import './CookingFlow.css'

export function CookingFlow() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [phase, setPhase] = useState('steps')
  const [stepIndex, setStepIndex] = useState(0)
  const [notes, setNotes] = useState('')
  const [mealType, setMealType] = useState('dinner')
  const [usage, setUsage] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!id || !householdId) return
    const [r, p] = await Promise.all([fetchRecipe(id), fetchPantry(householdId)])
    setRecipe(r)
    setUsage(
      (r.recipe_ingredients ?? []).map((ing) => {
        const pantryItem = findPantryItem(ing, p)
        return {
          name: ing.name,
          quantity_used: ing.quantity,
          unit: ing.unit,
          pantry_item_id: pantryItem?.id ?? ing.pantry_item_id ?? null,
        }
      }),
    )
  }, [id, householdId])

  useEffect(() => {
    load()
  }, [load])

  if (!recipe) return <p className="empty-state">Loading…</p>

  const steps = recipe.recipe_steps ?? []
  const isLastStep = stepIndex >= steps.length - 1
  const currentStep = steps[stepIndex]

  const finishSteps = () => setPhase('postcook')

  const handleDone = async () => {
    setLoading(true)
    try {
      await completeCooking(householdId, id, user?.id, { mealType, notes, usage })
      navigate(`/recipes/${id}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'postcook') {
    return (
      <div className="cooking-flow cooking-flow--post">
        <h2>How was the result?</h2>
        <div className="card">
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Taste, tweaks for next time…" />
          </label>
          <label>
            Meal type
            <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
              {MEAL_TYPES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="card cooking-flow__usage">
          <h3>Ingredients used</h3>
          <p className="cooking-flow__hint">Adjust amounts if you didn&apos;t follow the recipe exactly.</p>
          {usage.map((u, i) => (
            <div key={i} className="cooking-flow__usage-row">
              <span>{u.name}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={u.quantity_used}
                onChange={(e) => {
                  const next = [...usage]
                  next[i] = { ...next[i], quantity_used: e.target.value }
                  setUsage(next)
                }}
              />
              <select
                value={u.unit}
                onChange={(e) => {
                  const next = [...usage]
                  next[i] = { ...next[i], unit: e.target.value }
                  setUsage(next)
                }}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <Button variant="secondary" fullWidth onClick={() => navigate(`/recipes/${id}/edit`)}>
          Update recipe?
        </Button>
        <Button fullWidth disabled={loading} onClick={handleDone}>
          {loading ? 'Saving…' : 'Done'}
        </Button>
      </div>
    )
  }

  if (!steps.length) {
    return (
      <div className="cooking-flow">
        <p className="empty-state">No steps defined. Add steps in the recipe editor.</p>
        <Button fullWidth onClick={() => navigate(`/recipes/${id}`)}>Back</Button>
      </div>
    )
  }

  const stepImg = getPublicUrl(currentStep?.image_path)

  return (
    <div className="cooking-flow">
      <div className="cooking-flow__progress">
        Step {stepIndex + 1} of {steps.length}
      </div>
      <div className="card cooking-flow__step-card">
        <h2>Step {stepIndex + 1}</h2>
        {stepImg && <img src={stepImg} alt="" className="cooking-flow__step-img" />}
        <p className="cooking-flow__instruction">{currentStep.instruction}</p>
      </div>
      <div className="cooking-flow__footer">
        {isLastStep ? (
          <Button fullWidth onClick={finishSteps}>Finished cooking</Button>
        ) : (
          <Button fullWidth onClick={() => setStepIndex((i) => i + 1)}>Next step</Button>
        )}
        <Button variant="ghost" fullWidth onClick={() => navigate(`/recipes/${id}`)}>
          Exit
        </Button>
      </div>
    </div>
  )
}
