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
import { useHousehold } from '../../hooks/useHousehold'
import { useRealtime } from '../../hooks/useRealtime'
import { fetchDiaryMonth, upsertDiaryEntry } from '../../lib/recipes'
import './PlanPage.css'

const DIARY_SLOTS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snacks' },
  { value: 'dinner', label: 'Dinner' },
]

export function PlanPage() {
  const { householdId } = useHousehold()
  const [month, setMonth] = useState(new Date())
  const [entries, setEntries] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(null)

  const load = useCallback(async () => {
    if (!householdId) return
    const start = format(startOfMonth(month), 'yyyy-MM-dd')
    const end = format(endOfMonth(month), 'yyyy-MM-dd')
    setEntries(await fetchDiaryMonth(householdId, start, end))
  }, [householdId, month])

  useEffect(() => {
    load()
  }, [load])

  useRealtime(householdId, ['meal_diary'], load)

  const monthStart = startOfMonth(month)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(endOfMonth(month))
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const entriesForDay = (day) => {
    const d = format(day, 'yyyy-MM-dd')
    return entries.filter((e) => e.diary_date === d)
  }

  const dayHasNotes = (day) =>
    entriesForDay(day).some((e) => e.content?.trim())

  const selectDay = (day) => {
    setSelectedDay(day)
    const dayEntries = entriesForDay(day)
    const next = {}
    for (const slot of DIARY_SLOTS) {
      const row = dayEntries.find((e) => e.meal_type === slot.value)
      next[slot.value] = row?.content ?? ''
    }
    setDrafts(next)
  }

  const saveSlot = async (mealType) => {
    if (!selectedDay || !householdId) return
    const dateStr = format(selectedDay, 'yyyy-MM-dd')
    setSaving(mealType)
    try {
      await upsertDiaryEntry(householdId, dateStr, mealType, drafts[mealType] ?? '')
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="plan-page">
      <p className="plan-page__intro">Tap a day and jot down what you ate or plan to eat — like a little food diary.</p>

      <div className="plan-page__nav">
        <button type="button" onClick={() => setMonth((m) => addDays(startOfMonth(m), -1))}>←</button>
        <h2>{format(month, 'MMMM yyyy')}</h2>
        <button type="button" onClick={() => setMonth((m) => addDays(endOfMonth(m), 1))}>→</button>
      </div>

      <div className="plan-calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="plan-calendar__head">{d}</span>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month)
          const hasNotes = dayHasNotes(day)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`plan-calendar__day ${!inMonth ? 'plan-calendar__day--muted' : ''} ${isSelected ? 'plan-calendar__day--selected' : ''}`}
              onClick={() => selectDay(day)}
            >
              {format(day, 'd')}
              {hasNotes && <span className="plan-calendar__dot" />}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <div className="card plan-page__day-detail">
          <h3>{format(selectedDay, 'EEEE, MMM d')}</h3>
          {DIARY_SLOTS.map((slot) => (
            <label key={slot.value} className="plan-page__diary-field">
              <span>{slot.label}</span>
              <textarea
                value={drafts[slot.value] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [slot.value]: e.target.value }))}
                onBlur={() => saveSlot(slot.value)}
                rows={2}
                placeholder={`What for ${slot.label.toLowerCase()}?`}
              />
              {saving === slot.value && <small className="plan-page__saving">Saving…</small>}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
