import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useHousehold } from '../../hooks/useHousehold'
import { useAuth } from '../../hooks/useAuth'
import { findPantryItem } from '../../lib/pantryMatch'
import { loadHouseholdDisplayNames, getDisplayName } from '../../lib/profiles'
import { completeCooking, deductPantryUsage, fetchRecipe, fetchPantry } from '../../lib/recipes'
import { getPublicUrl } from '../../lib/storage'
import { MEAL_TYPES, formatQuantity } from '../../lib/units'
import './CookingFlow.css'

function buildPantryRows(ingredients, pantry) {
  return (ingredients ?? []).map((ing) => {
    const pantryItem = findPantryItem(ing, pantry)
    return {
      name: ing.name,
      pantry_item_id: pantryItem?.id ?? ing.pantry_item_id ?? null,
      pantry_quantity: pantryItem ? pantryItem.quantity : null,
      pantry_unit: pantryItem?.unit ?? ing.unit,
      quantity_used: '',
    }
  })
}

export function CookingFlow() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { householdId } = useHousehold()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState(null)
  const [pantry, setPantry] = useState([])
  const [phase, setPhase] = useState('prep')
  const [prepIndex, setPrepIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [notes, setNotes] = useState('')
  const [mealType, setMealType] = useState('dinner')
  const [chefUserId, setChefUserId] = useState('')
  const [members, setMembers] = useState([])
  const [displayNameMap, setDisplayNameMap] = useState({})
  const [recordedUsage, setRecordedUsage] = useState([])
  const [pantryDeducted, setPantryDeducted] = useState(false)
  const [showRemovePantry, setShowRemovePantry] = useState(false)
  const [pantryRows, setPantryRows] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!id || !householdId) return
    const [r, p, names] = await Promise.all([
      fetchRecipe(id),
      fetchPantry(householdId),
      loadHouseholdDisplayNames(householdId),
    ])
    setRecipe(r)
    setPantry(p)
    setMembers(names.members)
    setDisplayNameMap(names.displayNameMap)
    const cookState = location.state?.cookState
    if (cookState) {
      setPhase(cookState.phase ?? 'postcook')
      setNotes(cookState.notes ?? '')
      setMealType(cookState.mealType ?? 'dinner')
      setChefUserId(cookState.chefUserId ?? user?.id ?? '')
      setPantryDeducted(cookState.pantryDeducted ?? false)
      setRecordedUsage(cookState.recordedUsage ?? [])
    } else {
      if (user?.id) setChefUserId(user.id)
      const prep = r.recipe_preparation_steps ?? []
      const recipeSteps = r.recipe_steps ?? []
      if (prep.length) setPhase('prep')
      else if (recipeSteps.length) setPhase('steps')
      else setPhase('postcook')
    }
  }, [id, householdId, user, location.state])

  useEffect(() => {
    load()
  }, [load])

  if (!recipe) return <p className="empty-state">Loading…</p>

  const prepSteps = recipe.recipe_preparation_steps ?? []
  const steps = recipe.recipe_steps ?? []
  const isLastPrep = prepIndex >= prepSteps.length - 1
  const currentPrep = prepSteps[prepIndex]
  const isLastStep = stepIndex >= steps.length - 1
  const currentStep = steps[stepIndex]

  const finishPrep = () => {
    if (steps.length) setPhase('steps')
    else setPhase('postcook')
  }

  const finishSteps = () => setPhase('postcook')

  const openRemovePantry = () => {
    if (pantryDeducted) {
      alert('Pantry was already updated for this cooking session.')
      return
    }
    setPantryRows(buildPantryRows(recipe.recipe_ingredients, pantry))
    setShowRemovePantry(true)
  }

  const confirmRemovePantry = async () => {
    setLoading(true)
    try {
      const recorded = await deductPantryUsage(pantryRows)
      setRecordedUsage(recorded)
      setPantryDeducted(true)
      setShowRemovePantry(false)
      const p = await fetchPantry(householdId)
      setPantry(p)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDone = async () => {
    setLoading(true)
    try {
      await completeCooking(householdId, id, user?.id, {
        mealType,
        notes,
        usage: recordedUsage,
        chefUserId: chefUserId || user?.id,
      })
      navigate('/pantry')
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const goToEdit = () => {
    navigate(`/recipes/${id}/edit`, {
      state: {
        returnTo: `/recipes/${id}/cook`,
        cookState: {
          phase: 'postcook',
          notes,
          mealType,
          chefUserId,
          pantryDeducted,
          recordedUsage,
        },
      },
    })
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
          <label>
            Who&apos;s the Chef?
            <select value={chefUserId} onChange={(e) => setChefUserId(e.target.value)}>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {getDisplayName(m.user_id, displayNameMap)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {pantryDeducted && (
          <p className="cooking-flow__hint">Pantry quantities were updated.</p>
        )}
        <Button variant="secondary" fullWidth onClick={goToEdit}>
          Update recipe?
        </Button>
        <Button variant="secondary" fullWidth onClick={openRemovePantry} disabled={pantryDeducted}>
          Remove items from pantry
        </Button>
        <Button fullWidth disabled={loading} onClick={handleDone}>
          {loading ? 'Saving…' : 'Done'}
        </Button>

        <Modal open={showRemovePantry} onClose={() => setShowRemovePantry(false)} title="Remove items from pantry">
          <p className="cooking-flow__hint">Enter how much you used in your pantry units.</p>
          {pantryRows.length === 0 ? (
            <p>No ingredients in this recipe.</p>
          ) : (
            <div className="cooking-flow__usage">
              {pantryRows.map((row, i) => (
                <div key={i} className="cooking-flow__usage-row">
                  <div className="cooking-flow__usage-info">
                    <strong>{row.name}</strong>
                    {row.pantry_item_id ? (
                      <span className="cooking-flow__pantry-qty">
                        In pantry: {formatQuantity(row.pantry_quantity, row.pantry_unit)}
                      </span>
                    ) : (
                      <span className="cooking-flow__pantry-qty">Not linked to pantry</span>
                    )}
                  </div>
                  {row.pantry_item_id && (
                    <div className="cooking-flow__usage-inputs">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Amount used"
                        value={row.quantity_used}
                        onChange={(e) => {
                          const next = [...pantryRows]
                          next[i] = { ...next[i], quantity_used: e.target.value }
                          setPantryRows(next)
                        }}
                      />
                      <span>{row.pantry_unit}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" fullWidth onClick={() => setShowRemovePantry(false)}>
            Back
          </Button>
          <Button fullWidth disabled={loading} onClick={confirmRemovePantry}>
            {loading ? 'Updating…' : 'Confirm removal'}
          </Button>
        </Modal>
      </div>
    )
  }

  if (phase === 'prep' && prepSteps.length) {
    const prepImg = getPublicUrl(currentPrep?.image_path)
    return (
      <div className="cooking-flow">
        <div className="cooking-flow__progress">
          Preparation {prepIndex + 1} of {prepSteps.length}
        </div>
        <div className="card cooking-flow__step-card">
          <h2>Prep {prepIndex + 1}</h2>
          {prepImg && <img src={prepImg} alt="" className="cooking-flow__step-img" />}
          <p className="cooking-flow__instruction">{currentPrep.instruction}</p>
        </div>
        <div className="cooking-flow__footer">
          {prepIndex > 0 && (
            <Button variant="secondary" fullWidth onClick={() => setPrepIndex((i) => i - 1)}>
              Previous
            </Button>
          )}
          {isLastPrep ? (
            <Button fullWidth onClick={finishPrep}>
              {steps.length ? 'Start cooking steps' : 'Finished cooking'}
            </Button>
          ) : (
            <Button fullWidth onClick={() => setPrepIndex((i) => i + 1)}>Next</Button>
          )}
          <Button variant="ghost" fullWidth onClick={() => navigate(`/recipes/${id}`)}>
            Exit
          </Button>
        </div>
      </div>
    )
  }

  if (!steps.length) {
    return (
      <div className="cooking-flow">
        <p className="empty-state">No cooking steps defined. You can still log your result.</p>
        <Button fullWidth onClick={() => setPhase('postcook')}>How was the result?</Button>
        <Button variant="ghost" fullWidth onClick={() => navigate(`/recipes/${id}`)}>Back</Button>
      </div>
    )
  }

  if (showAllSteps) {
    return (
      <div className="cooking-flow">
        <h2>All steps — {recipe.name}</h2>
        <ol className="cooking-flow__all-steps">
          {steps.map((step, i) => {
            const img = getPublicUrl(step.image_path)
            return (
              <li key={step.id ?? i} className={i === stepIndex ? 'cooking-flow__all-steps--current' : ''}>
                <strong>Step {step.step_number}</strong>
                {img && <img src={img} alt="" className="cooking-flow__step-img" />}
                <p>{step.instruction}</p>
              </li>
            )
          })}
        </ol>
        <Button fullWidth onClick={() => setShowAllSteps(false)}>Back to current step</Button>
      </div>
    )
  }

  const stepImg = getPublicUrl(currentStep?.image_path)

  return (
    <div className="cooking-flow">
      <div className="cooking-flow__progress">
        Step {stepIndex + 1} of {steps.length}
      </div>
      <Button variant="ghost" fullWidth onClick={() => setShowAllSteps(true)}>
        View all steps
      </Button>
      <div className="card cooking-flow__step-card">
        <h2>Step {stepIndex + 1}</h2>
        {stepImg && <img src={stepImg} alt="" className="cooking-flow__step-img" />}
        <p className="cooking-flow__instruction">{currentStep.instruction}</p>
      </div>
      <div className="cooking-flow__footer">
        {stepIndex > 0 && (
          <Button variant="secondary" fullWidth onClick={() => setStepIndex((i) => i - 1)}>
            Previous step
          </Button>
        )}
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
