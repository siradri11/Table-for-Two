import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { useHousehold } from '../../hooks/useHousehold'
import { useRealtime } from '../../hooks/useRealtime'
import {
  addToCart,
  fetchCartItems,
  removeFromCart,
  saveCheckedToPantry,
  setCartItemChecked,
  updateCartItem,
  updateCartItemQuantity,
} from '../../lib/shoppingCart'
import { UNITS } from '../../lib/units'
import './CartPage.css'

export function CartPage() {
  const { householdId } = useHousehold()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [newUnit, setNewUnit] = useState('pcs')
  const [editItem, setEditItem] = useState(null)
  const [editName, setEditName] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editUnit, setEditUnit] = useState('pcs')

  const load = useCallback(async () => {
    if (!householdId) return
    setItems(await fetchCartItems(householdId))
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtime(householdId, ['shopping_cart_items'], load)

  const checkedCount = items.filter((i) => i.is_checked).length

  const toggleCheck = async (item) => {
    try {
      await setCartItemChecked(item.id, !item.is_checked)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const updateQty = async (item, qty) => {
    try {
      await updateCartItemQuantity(item.id, qty)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await addToCart(householdId, {
        name: newName.trim(),
        quantity: Number(newQty) || 1,
        unit: newUnit,
        source: 'manual',
      })
      setNewName('')
      setNewQty('1')
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const openEdit = (item) => {
    setEditItem(item)
    setEditName(item.name)
    setEditQty(String(item.quantity))
    setEditUnit(item.unit)
  }

  const saveEdit = async () => {
    if (!editItem || !editName.trim()) return
    try {
      await updateCartItem(editItem.id, {
        name: editName.trim(),
        quantity: editQty,
        unit: editUnit,
      })
      setEditItem(null)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSaveToPantry = async () => {
    const checked = items.filter((i) => i.is_checked)
    if (!checked.length) return
    setSaving(true)
    try {
      await saveCheckedToPantry(checked)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cart-page">
      <p className="cart-page__intro">
        Check items when you buy them, then tap Save to pantry. Unchecked items stay on your list.
      </p>

      <form className="card cart-page__add-form" onSubmit={handleAdd}>
        <h3>Add item</h3>
        <input
          placeholder="Item name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <div className="cart-page__add-row">
          <input
            type="number"
            min="0.01"
            step="any"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
          />
          <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <Button type="submit">Add</Button>
        </div>
      </form>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Your cart is empty. Add items manually or from pantry and meal planning.</p>
      ) : (
        <ul className="cart-list">
          {items.map((item) => (
            <li key={item.id} className={`card cart-list__item ${item.is_checked ? 'cart-list__item--checked' : ''}`}>
              <label className="cart-list__check">
                <input
                  type="checkbox"
                  checked={Boolean(item.is_checked)}
                  onChange={() => toggleCheck(item)}
                />
                <span className="cart-list__name">{item.name}</span>
              </label>
              <div className="cart-list__qty-row">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  defaultValue={item.quantity}
                  onBlur={(e) => updateQty(item, e.target.value)}
                />
                <span>{item.unit}</span>
              </div>
              <div className="cart-list__actions">
                <button type="button" className="cart-list__edit" onClick={() => openEdit(item)}>
                  Edit
                </button>
                <button type="button" className="cart-list__remove" onClick={() => removeFromCart(item.id).then(load)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {checkedCount > 0 && (
        <div className="cart-page__save-bar">
          <Button fullWidth disabled={saving} onClick={handleSaveToPantry}>
            {saving ? 'Saving…' : `Save ${checkedCount} to pantry`}
          </Button>
        </div>
      )}

      <Modal open={Boolean(editItem)} onClose={() => setEditItem(null)} title="Edit cart item">
        <label>
          Name
          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </label>
        <div className="cart-page__add-row">
          <input
            type="number"
            min="0.01"
            step="any"
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
          />
          <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <Button fullWidth onClick={saveEdit}>Save</Button>
        <Button variant="ghost" fullWidth onClick={() => setEditItem(null)}>Cancel</Button>
      </Modal>
    </div>
  )
}
