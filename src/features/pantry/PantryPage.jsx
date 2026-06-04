import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { useRealtime } from '../../hooks/useRealtime'
import { supabase } from '../../supabaseClient'
import { formatQuantity } from '../../lib/units'
import './PantryPage.css'

export function PantryPage() {
  const { householdId } = useHousehold()
  const [items, setItems] = useState([])
  const [tags, setTags] = useState([])
  const [filterTag, setFilterTag] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    const [itemsRes, tagsRes] = await Promise.all([
      supabase
        .from('pantry_items')
        .select('*, pantry_item_tags(tag_id)')
        .eq('household_id', householdId)
        .order('name'),
      supabase.from('tags').select('*').eq('household_id', householdId).eq('category', 'pantry').order('name'),
    ])
    if (!itemsRes.error) setItems(itemsRes.data ?? [])
    if (!tagsRes.error) setTags(tagsRes.data ?? [])
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtime(householdId, ['pantry_items', 'tags'], load)

  const pantryTags = tags
  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase()
    if (q && !item.name.toLowerCase().includes(q)) return false
    if (!filterTag) return true
    const itemTags = item.pantry_item_tags?.map((t) => t.tag_id) ?? []
    return itemTags.includes(filterTag)
  })

  const deleteItem = async (id) => {
    if (!confirm('Remove this item from the pantry?')) return
    await supabase.from('pantry_items').delete().eq('id', id)
    load()
  }

  return (
    <div className="pantry-page">
      <div className="pantry-page__actions">
        <input
          type="search"
          placeholder="Search pantry…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pantry-page__search"
        />
        <Link to="/pantry/new">
          <Button>+ Add item</Button>
        </Link>
        <Link to="/pantry/tags" className="pantry-page__tags-link">
          Manage tags
        </Link>
      </div>

      <div className="pantry-page__filters">
        <TagChip
          tag={{ name: 'All', color: '#ebe6df' }}
          selected={!filterTag}
          onClick={() => setFilterTag(null)}
          small
        />
        {pantryTags.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            selected={filterTag === tag.id}
            onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
            small
          />
        ))}
      </div>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">Your pantry is waiting. Add your first item!</p>
      ) : (
        <ul className="pantry-list">
          {filtered.map((item) => {
            const itemTagIds = item.pantry_item_tags?.map((t) => t.tag_id) ?? []
            const itemTags = pantryTags.filter((t) => itemTagIds.includes(t.id))
            return (
              <li key={item.id} className="card pantry-list__item">
                <Link to={`/pantry/${item.id}/edit`} className="pantry-list__link">
                  <div className="pantry-list__main">
                    <strong>{item.name}</strong>
                    <span className="pantry-list__qty">{formatQuantity(item.quantity, item.unit)}</span>
                  </div>
                  {itemTags.length > 0 && (
                    <div className="pantry-list__tags">
                      {itemTags.map((t) => (
                        <TagChip key={t.id} tag={t} small />
                      ))}
                    </div>
                  )}
                </Link>
                <button type="button" className="pantry-list__delete" onClick={() => deleteItem(item.id)}>
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
