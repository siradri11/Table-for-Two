import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { TagChip } from '../../components/TagChip'
import { useHousehold } from '../../hooks/useHousehold'
import { useRealtime } from '../../hooks/useRealtime'
import { addToCart } from '../../lib/shoppingCart'
import { getPublicUrl } from '../../lib/storage'
import { supabase } from '../../supabaseClient'
import { formatQuantity } from '../../lib/units'
import './PantryPage.css'

const VIEW_KEY = 'pantry-view'

function isLowStock(item) {
  if (item.low_stock_threshold == null) return false
  return Number(item.quantity) <= Number(item.low_stock_threshold)
}

function PantryItemCard({ item, itemTags, low, onDelete, onAddToCart, layout }) {
  const thumb = getPublicUrl(item.image_path)
  const content = (
    <>
      {thumb ? (
        <img src={thumb} alt="" className={`pantry-list__thumb ${layout === 'grid' ? 'pantry-grid__thumb' : ''}`} />
      ) : (
        <div className={`pantry-list__thumb pantry-list__thumb--placeholder ${layout === 'grid' ? 'pantry-grid__thumb' : ''}`}>🥫</div>
      )}
      <div className={layout === 'grid' ? 'pantry-grid__body' : 'pantry-list__body'}>
        <div className="pantry-list__main">
          <strong>
            {item.name}
            {low && <span className="pantry-list__low-badge">Low stock</span>}
          </strong>
          <span className="pantry-list__qty">{formatQuantity(item.quantity, item.unit)}</span>
        </div>
        {itemTags.length > 0 && (
          <div className="pantry-list__tags">
            {itemTags.map((t) => (
              <TagChip key={t.id} tag={t} small />
            ))}
          </div>
        )}
      </div>
    </>
  )

  if (layout === 'grid') {
    return (
      <li className="card pantry-grid__item">
        <Link to={`/pantry/${item.id}/edit`} className="pantry-grid__link">
          {content}
        </Link>
        {low && (
          <Button variant="secondary" onClick={() => onAddToCart(item)}>
            Cart
          </Button>
        )}
      </li>
    )
  }

  return (
    <li className="card pantry-list__item">
      <Link to={`/pantry/${item.id}/edit`} className="pantry-list__link">
        {content}
      </Link>
      <div className="pantry-list__side">
        {low && (
          <Button variant="secondary" onClick={() => onAddToCart(item)}>
            Add to cart
          </Button>
        )}
        <button type="button" className="pantry-list__delete" onClick={() => onDelete(item.id)}>
          Delete
        </button>
      </div>
    </li>
  )
}

export function PantryPage() {
  const { householdId } = useHousehold()
  const [items, setItems] = useState([])
  const [tags, setTags] = useState([])
  const [filterTag, setFilterTag] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'list')

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

  const setViewMode = (mode) => {
    setView(mode)
    localStorage.setItem(VIEW_KEY, mode)
  }

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

  const addItemToCart = async (item) => {
    try {
      const qty =
        item.low_stock_threshold != null
          ? Math.max(1, Number(item.low_stock_threshold) - Number(item.quantity))
          : 1
      await addToCart(householdId, {
        name: item.name,
        quantity: qty,
        unit: item.unit,
        pantry_item_id: item.id,
        source: 'low_stock',
      })
      alert('Added to shopping cart')
    } catch (err) {
      alert(err.message)
    }
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
        <div className="pantry-page__view-toggle">
          <button
            type="button"
            className={view === 'list' ? 'pantry-page__view-btn--active' : ''}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            type="button"
            className={view === 'grid' ? 'pantry-page__view-btn--active' : ''}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
        </div>
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
        <ul className={view === 'grid' ? 'pantry-grid' : 'pantry-list'}>
          {filtered.map((item) => {
            const itemTagIds = item.pantry_item_tags?.map((t) => t.tag_id) ?? []
            const itemTags = pantryTags.filter((t) => itemTagIds.includes(t.id))
            return (
              <PantryItemCard
                key={item.id}
                item={item}
                itemTags={itemTags}
                low={isLowStock(item)}
                onDelete={deleteItem}
                onAddToCart={addItemToCart}
                layout={view}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}
