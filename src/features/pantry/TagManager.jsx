import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useHousehold } from '../../hooks/useHousehold'
import { supabase } from '../../supabaseClient'
import './TagManager.css'

const COLOR_PRESETS = ['#F5D5D5', '#E8A0A0', '#A8D5A2', '#FFD89B', '#9EC5E8', '#D4C4A8', '#D4A5A5', '#C9B8E8']

export function TagManager() {
  const [params] = useSearchParams()
  const category = params.get('category') === 'recipe' ? 'recipe' : 'pantry'
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const [tags, setTags] = useState([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0])
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    if (!householdId) return
    const { data } = await supabase
      .from('tags')
      .select('*')
      .eq('household_id', householdId)
      .eq('category', category)
      .order('is_preset', { ascending: false })
      .order('name')
    setTags(data ?? [])
  }, [householdId, category])

  useEffect(() => {
    load()
  }, [load])

  const addTag = async (e) => {
    e.preventDefault()
    if (!newName.trim() || !householdId) return
    await supabase.from('tags').insert({
      household_id: householdId,
      name: newName.trim(),
      color: newColor,
      category,
      is_preset: false,
    })
    setNewName('')
    load()
  }

  const updateTag = async (tag) => {
    await supabase.from('tags').update({ name: tag.name, color: tag.color }).eq('id', tag.id)
    setEditing(null)
    load()
  }

  const deleteTag = async (tag) => {
    if (tag.is_preset) return
    if (!confirm(`Delete tag "${tag.name}"?`)) return
    await supabase.from('tags').delete().eq('id', tag.id)
    load()
  }

  const backPath = category === 'recipe' ? '/recipes' : '/pantry'

  return (
    <div className="tag-manager">
      <Button variant="ghost" onClick={() => navigate(backPath)}>← Back</Button>
      <h2>{category === 'recipe' ? 'Recipe tags' : 'Pantry tags'}</h2>

      <ul className="tag-manager__list">
        {tags.map((tag) => (
          <li key={tag.id} className="card tag-manager__item">
            {editing === tag.id ? (
              <>
                <input
                  value={tag.name}
                  onChange={(e) =>
                    setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, name: e.target.value } : t)))
                  }
                />
                <div className="tag-manager__colors">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch ${tag.color === c ? 'color-swatch--active' : ''}`}
                      style={{ background: c }}
                      onClick={() =>
                        setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, color: c } : t)))
                      }
                    />
                  ))}
                </div>
                <Button onClick={() => updateTag(tags.find((t) => t.id === tag.id))}>Save</Button>
              </>
            ) : (
              <>
                <span className="tag-manager__chip" style={{ background: tag.color }}>{tag.name}</span>
                {tag.is_preset && <span className="tag-manager__preset">Preset</span>}
                <div className="tag-manager__actions">
                  <button type="button" onClick={() => setEditing(tag.id)}>Edit</button>
                  {!tag.is_preset && (
                    <button type="button" className="danger" onClick={() => deleteTag(tag)}>
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <form className="card tag-manager__new" onSubmit={addTag}>
        <h3>Create custom tag</h3>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tag name" required />
        <div className="tag-manager__colors">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${newColor === c ? 'color-swatch--active' : ''}`}
              style={{ background: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
        </div>
        <Button type="submit" fullWidth>Add tag</Button>
      </form>
    </div>
  )
}
