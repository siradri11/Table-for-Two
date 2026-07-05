import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { deletePantryItem } from '../../lib/pantry'
import { getPublicUrl, uploadImage } from '../../lib/storage'
import { supabase } from '../../supabaseClient'
import { UNITS } from '../../lib/units'
import './PantryItemForm.css'

export function PantryItemForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const cameraInputRef = useRef(null)
  const albumInputRef = useRef(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const [notes, setNotes] = useState('')
  const [lowStock, setLowStock] = useState('')
  const [imagePath, setImagePath] = useState(null)
  const [imageFile, setImageFile] = useState(null)
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
            setLowStock(data.low_stock_threshold != null ? String(data.low_stock_threshold) : '')
            setImagePath(data.image_path)
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

  const handleImageSelect = (file) => {
    if (file) setImageFile(file)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!householdId || !name.trim()) return
    setLoading(true)
    setError('')
    const qty = Math.max(0, Number(quantity) || 0)
    const low = lowStock.trim() === '' ? null : Math.max(0, Number(lowStock) || 0)

    try {
      let path = imagePath
      if (imageFile) {
        path = await uploadImage(householdId, imageFile, 'pantry')
      }

      const payload = {
        name: name.trim(),
        quantity: qty,
        unit,
        notes: notes || null,
        low_stock_threshold: low,
        image_path: path,
        updated_at: new Date().toISOString(),
      }

      let itemId = id
      if (isEdit) {
        const { error: updErr } = await supabase.from('pantry_items').update(payload).eq('id', id)
        if (updErr) throw updErr
      } else {
        const { data, error: insErr } = await supabase
          .from('pantry_items')
          .insert({ household_id: householdId, ...payload })
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

  const handleDelete = async () => {
    if (!confirm('Remove this item from the pantry?')) return
    setLoading(true)
    setError('')
    try {
      await deletePantryItem(id)
      navigate('/pantry')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const preview = imageFile ? URL.createObjectURL(imageFile) : getPublicUrl(imagePath)

  return (
    <form className="pantry-form card" onSubmit={save}>
      <h2>{isEdit ? 'Edit item' : 'Add to pantry'}</h2>
      {error && <p className="form-error">{error}</p>}
      <fieldset className="pantry-form__photo">
        <legend>Photo (optional)</legend>
        <div className="pantry-form__photo-btns">
          <Button type="button" variant="secondary" onClick={() => cameraInputRef.current?.click()}>
            Take photo
          </Button>
          <Button type="button" variant="ghost" onClick={() => albumInputRef.current?.click()}>
            Choose from album
          </Button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
        />
        <input
          ref={albumInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleImageSelect(e.target.files?.[0] ?? null)}
        />
      </fieldset>
      {preview && <img src={preview} alt="" className="pantry-form__preview" />}
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
        Low stock at (optional, same unit)
        <input
          type="number"
          min="0"
          step="any"
          value={lowStock}
          onChange={(e) => setLowStock(e.target.value)}
          placeholder="Notify when at or below"
        />
      </label>
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
      {isEdit && (
        <Button type="button" variant="secondary" fullWidth disabled={loading} onClick={handleDelete}>
          Delete
        </Button>
      )}
    </form>
  )
}
