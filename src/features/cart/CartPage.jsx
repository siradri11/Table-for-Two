import { useCallback, useEffect, useState } from 'react'
import { useHousehold } from '../../hooks/useHousehold'
import { useRealtime } from '../../hooks/useRealtime'
import { completeCartItem, fetchCartItems, removeFromCart, updateCartItemQuantity } from '../../lib/shoppingCart'
import './CartPage.css'

export function CartPage() {
  const { householdId } = useHousehold()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId) return
    setItems(await fetchCartItems(householdId))
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    load()
  }, [load])

  useRealtime(householdId, ['shopping_cart_items'], load)

  const toggleCheck = async (item) => {
    try {
      await completeCartItem(item)
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

  return (
    <div className="cart-page">
      <p className="cart-page__intro">
        Check off items when you buy them — pantry quantities update automatically.
      </p>
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Your cart is empty. Add items from low-stock pantry or meal planning.</p>
      ) : (
        <ul className="cart-list">
          {items.map((item) => (
            <li key={item.id} className="card cart-list__item">
              <label className="cart-list__check">
                <input type="checkbox" onChange={() => toggleCheck(item)} />
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
              <button type="button" className="cart-list__remove" onClick={() => removeFromCart(item.id).then(load)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
