import { useCallback, useEffect, useState } from 'react'
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useAuth } from '../../hooks/useAuth'
import { useHousehold } from '../../hooks/useHousehold'
import { useRealtime } from '../../hooks/useRealtime'
import { aggregatePlanIngredients, checkIngredient } from '../../lib/pantryMatch'
import { getDisplayName, loadHouseholdDisplayNames } from '../../lib/profiles'
import { addToCart } from '../../lib/shoppingCart'
import { fetchPantry, logManualMeal } from '../../lib/recipes'
import { supabase } from '../../supabaseClient'
import { MEAL_TYPES, formatQuantity } from '../../lib/units'
import './PlanPage.css'

export function PlanPage() {
  const { householdId } = useHousehold()
  const { user } = useAuth()
  const [month, setMonth] = useState(new Date())
  const [cookLogs, setCookLogs] = useState([])
  const [mealPlans, setMealPlans] = useState([])
  const [recipes, setRecipes] = useState([])
  const [pantry, setPantry] = useState([])
  const [displayNameMap, setDisplayNameMap] = useState({})
  const [members, setMembers] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [planMode, setPlanMode] = useState(false)
  const [showShop, setShowShop] = useState(false)
  const [shopList, setShopList] = useState([])
  const [showLogMeal, setShowLogMeal] = useState(false)
  const [mealTitle, setMealTitle] = useState('')
  const [mealType, setMealType] = useState('dinner')
  const [mealNotes, setMealNotes] = useState('')
  const [mealChefId, setMealChefId] = useState('')
  const [logLoading, setLogLoading] = useState(false)

  const load = useCallback(async () => {
    if (!householdId) return
    const start = format(startOfMonth(month), 'yyyy-MM-dd')
    const end = format(endOfMonth(month), 'yyyy-MM-dd')
    const [logs, plans, recs, pan, names] = await Promise.all([
      supabase
        .from('cook_logs')
        .select('*, recipes(name)')
        .eq('household_id', householdId)
        .gte('cooked_at', `${start}T00:00:00`)
        .lte('cooked_at', `${end}T23:59:59`),
      supabase
        .from('meal_plans')
        .select('*, recipes(name)')
        .eq('household_id', householdId)
        .gte('plan_date', start)
        .lte('plan_date', end),
      supabase.from('recipes').select('id, name').eq('household_id', householdId).order('name'),
      fetchPantry(householdId),
      loadHouseholdDisplayNames(householdId),
    ])
    if (!logs.error) setCookLogs(logs.data ?? [])
    if (!plans.error) setMealPlans(plans.data ?? [])
    if (!recs.error) setRecipes(recs.data ?? [])
    setPantry(pan)
    setDisplayNameMap(names.displayNameMap)
    setMembers(names.members)
    if (user?.id) setMealChefId((prev) => prev || user.id)
  }, [householdId, month, user])

  useEffect(() => {
    load()
  }, [load])

  useRealtime(householdId, ['cook_logs', 'meal_plans'], load)

  const monthStart = startOfMonth(month)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(endOfMonth(month))
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const logsForDay = (day) =>
    cookLogs.filter((l) => isSameDay(new Date(l.cooked_at), day))

  const plansForDay = (day) => {
    const d = format(day, 'yyyy-MM-dd')
    return mealPlans.filter((p) => p.plan_date === d)
  }

  const addPlan = async (dateStr, mealType, recipeId) => {
    const { error } = await supabase.from('meal_plans').upsert(
      { household_id: householdId, plan_date: dateStr, meal_type: mealType, recipe_id: recipeId },
      { onConflict: 'household_id,plan_date,meal_type' },
    )
    if (error) alert(error.message)
    else load()
  }

  const removePlan = async (planId) => {
    await supabase.from('meal_plans').delete().eq('id', planId)
    load()
  }

  const deleteCookLog = async (logId) => {
    if (!confirm('Remove this meal from your history?')) return
    await supabase.from('cook_logs').delete().eq('id', logId)
    load()
  }

  const computeShopping = async () => {
    const plans = mealPlans
    const plannedRecipes = []
    for (const plan of plans) {
      const { data: ings } = await supabase.from('recipe_ingredients').select('*').eq('recipe_id', plan.recipe_id)
      plannedRecipes.push({ recipe: plan.recipes, ingredients: ings ?? [] })
    }
    const aggregated = aggregatePlanIngredients(plannedRecipes)
    const shortages = aggregated
      .map((ing) => ({ ing, check: checkIngredient(ing, pantry) }))
      .filter(({ check }) => !check.ok)
    setShopList(shortages)
    setShowShop(true)
  }

  const addShopItemToCart = async ({ ing, check }) => {
    const needed = Number(ing.quantity) || 0
    const have = check.reason === 'insufficient' ? Number(check.have) : 0
    const qty = Math.max(needed - have, needed)
    const pantryItem = pantry.find(
      (p) => p.id === check.pantryItemId || p.name.toLowerCase() === ing.name.toLowerCase(),
    )
    try {
      await addToCart(householdId, {
        name: ing.name,
        quantity: qty,
        unit: ing.unit,
        pantry_item_id: pantryItem?.id ?? null,
        source: 'plan',
      })
      alert('Added to shopping cart')
    } catch (err) {
      alert(err.message)
    }
  }

  const addAllShopToCart = async () => {
    for (const row of shopList) {
      await addShopItemToCart(row)
    }
    alert('All items added to cart')
  }

  const formatHistoryLine = (log) => {
    const chefId = log.chef_user_id || log.created_by
    const chef = chefId ? getDisplayName(chefId, displayNameMap) : 'Unknown'
    const name = log.recipes?.name || log.title || 'Meal'
    return `${name} (${log.meal_type}) — by Chef ${chef}`
  }

  const submitLogMeal = async (e) => {
    e.preventDefault()
    if (!mealTitle.trim() || !selectedDay || !householdId) return
    setLogLoading(true)
    try {
      const dayDate = new Date(selectedDay)
      dayDate.setHours(12, 0, 0, 0)
      await logManualMeal(householdId, user?.id, {
        title: mealTitle,
        mealType,
        notes: mealNotes,
        chefUserId: mealChefId || user?.id,
        cookedAt: dayDate.toISOString(),
      })
      setShowLogMeal(false)
      setMealTitle('')
      setMealNotes('')
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setLogLoading(false)
    }
  }

  const dayLogs = selectedDay ? logsForDay(selectedDay) : []
  const dayPlans = selectedDay ? plansForDay(selectedDay) : []

  return (
    <div className="plan-page">
      <div className="plan-page__nav">
        <button type="button" onClick={() => setMonth((m) => addDays(startOfMonth(m), -1))}>←</button>
        <h2>{format(month, 'MMMM yyyy')}</h2>
        <button type="button" onClick={() => setMonth((m) => addDays(endOfMonth(m), 1))}>→</button>
      </div>

      <div className="plan-page__toggle">
        <Button variant={planMode ? 'primary' : 'ghost'} onClick={() => setPlanMode(false)}>
          History
        </Button>
        <Button variant={planMode ? 'ghost' : 'primary'} onClick={() => setPlanMode(true)}>
          Plan meals
        </Button>
        {planMode && mealPlans.length > 0 && (
          <Button variant="secondary" onClick={computeShopping}>Shopping list</Button>
        )}
      </div>

      <div className="plan-calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="plan-calendar__head">{d}</span>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month)
          const hasLogs = logsForDay(day).length > 0
          const hasPlans = plansForDay(day).length > 0
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`plan-calendar__day ${!inMonth ? 'plan-calendar__day--muted' : ''} ${isSelected ? 'plan-calendar__day--selected' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              {format(day, 'd')}
              {(hasLogs || hasPlans) && <span className={`plan-calendar__dot ${hasPlans ? 'plan-calendar__dot--plan' : ''}`} />}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="card plan-page__day-detail">
          <h3>{format(selectedDay, 'EEEE, MMM d')}</h3>
          {!planMode && (
            <>
              <div className="plan-page__history-header">
                <h4>Cooked</h4>
                <Button variant="secondary" onClick={() => setShowLogMeal(true)}>
                  Log a meal
                </Button>
              </div>
              {dayLogs.length === 0 ? (
                <p className="plan-page__empty">Nothing logged this day.</p>
              ) : (
                <ul className="plan-page__history-list">
                  {dayLogs.map((l) => (
                    <li key={l.id} className="plan-page__history-item">
                      <span>
                        {formatHistoryLine(l)}
                        {l.notes && <span className="plan-page__note"> — {l.notes}</span>}
                      </span>
                      <button type="button" className="plan-page__remove" onClick={() => deleteCookLog(l.id)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {planMode && (
            <>
              <h4>Planned meals</h4>
              {MEAL_TYPES.map((meal) => {
                const plan = dayPlans.find((p) => p.meal_type === meal.value)
                return (
                  <div key={meal.value} className="plan-page__meal-row">
                    <span>{meal.label}</span>
                    <select
                      value={plan?.recipe_id ?? ''}
                      onChange={(e) => {
                        const rid = e.target.value
                        if (rid) addPlan(format(selectedDay, 'yyyy-MM-dd'), meal.value, rid)
                        else if (plan) removePlan(plan.id)
                      }}
                    >
                      <option value="">—</option>
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      <Modal open={showLogMeal} onClose={() => setShowLogMeal(false)} title="Log a meal">
        <form onSubmit={submitLogMeal}>
          <label>
            What did you eat?
            <input
              value={mealTitle}
              onChange={(e) => setMealTitle(e.target.value)}
              placeholder="e.g. Takeout pizza"
              required
            />
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
            Notes (optional)
            <textarea value={mealNotes} onChange={(e) => setMealNotes(e.target.value)} rows={2} />
          </label>
          <label>
            Who ate / cooked?
            <select value={mealChefId} onChange={(e) => setMealChefId(e.target.value)}>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {getDisplayName(m.user_id, displayNameMap)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" fullWidth disabled={logLoading}>
            {logLoading ? 'Saving…' : 'Save to history'}
          </Button>
        </form>
      </Modal>

      <Modal open={showShop} onClose={() => setShowShop(false)} title="Ingredients needed">
        {shopList.length === 0 ? (
          <p>You have enough in the pantry for your planned meals!</p>
        ) : (
          <>
            <Button variant="secondary" fullWidth onClick={addAllShopToCart}>
              Add all to shopping cart
            </Button>
            <ul className="plan-page__shop-list">
              {shopList.map((row, i) => (
                <li key={i}>
                  <strong>{row.ing.name}</strong> — need {formatQuantity(row.ing.quantity, row.ing.unit)}
                  {row.check.reason === 'insufficient' && ` (have ${formatQuantity(row.check.have, row.check.haveUnit)})`}
                  {row.check.reason === 'missing' && ' (not in pantry)'}
                  {row.check.reason === 'unit_mismatch' && ' (unit mismatch)'}
                  <br />
                  <small>For: {row.ing.recipes.join(', ')}</small>
                  <Button variant="ghost" onClick={() => addShopItemToCart(row)}>
                    Add to cart
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </div>
  )
}
