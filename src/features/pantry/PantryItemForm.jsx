import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { supabase } from '../../supabaseClient'
import { UNITS } from '../../lib/units'
import './PantryItemForm.css'

export function PantryItemForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const [notes, setNotes] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [tags, setTags] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!householdId) return
    supabase
      .from('tags')
      .select('*')
      .eq('household_id', householdId)
      .eq('category', 'pantry')
      .then(({ data }) => setTags(data ?? []))

    if (isEdit) {
      supabase
        .from('pantry_items')
        .select('*, pantry_item_tags(tag_id)')
        .eq('id', id)
        .single()
        .then(({ data }) => {
          if (data) {
            setName(data.name)
            setQuantity(String(data.quantity))
            setUnit(data.unit)
            setNotes(data.notes || '')
            setSelectedTags(data.pantry_item_tags?.map((t) => t.tag_id) ?? [])
          }
        })
    }
  }, [householdId, id, isEdit])

  const toggleTag = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    )
  }

  const save = async (e) => {
    e.preventDefault()
    if (!householdId || !name.trim()) return
    setLoading(true)
    setError('')
    const qty = Math.max(0, Number(quantity) || 0)

    try {
      let itemId = id
      if (isEdit) {
        const { error: updErr } = await supabase
          .from('pantry_items')
          .update({ name: name.trim(), quantity: qty, unit, notes: notes || null, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (updErr) throw updErr
      } else {
        const { data, error: insErr } = await supabase
          .from('pantry_items')
          .insert({ household_id: householdId, name: name.trim(), quantity: qty, unit, notes: notes || null })
          .select('id')
          .single()
        if (insErr) throw insErr
        itemId = data.id
      }

      await supabase.from('pantry_item_tags').delete().eq('pantry_item_id', itemId)
      if (selectedTags.length) {
        await supabase.from('pantry_item_tags').insert(
          selectedTags.map((tag_id) => ({ pantry_item_id: itemId, tag_id })),
        )
      }
      navigate('/pantry')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="pantry-form card" onSubmit={save}>
      <h2>{isEdit ? 'Edit item' : 'Add to pantry'}</h2>
      {error && <p className="form-error">{error}</p>}
      <label>
        Item name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div className="pantry-form__row">
        <label>
          Quantity
          <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </label>
        <label>
          Unit
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes (optional)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </label>
      <fieldset>
        <legend>Tags</legend>
        <div className="pantry-form__tags">
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              selected={selectedTags.includes(tag.id)}
              onClick={() => toggleTag(tag.id)}
            />
          ))}
        </div>
      </fieldset>
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Saving…' : 'Save'}
      </Button>
      <Button type="button" variant="ghost" fullWidth onClick={() => navigate('/pantry')}>
        Cancel
      </Button>
    </form>
  )
}
