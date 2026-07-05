import { normalizeName } from './pantryMatch'
import { supabase } from '../supabaseClient'

export async function fetchCartItems(householdId) {
  const { data, error } = await supabase
    .from('shopping_cart_items')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

function cartLineKey(item) {
  if (item.pantry_item_id) return `id:${item.pantry_item_id}`
  return `name:${normalizeName(item.name)}|${item.unit}`
}

export async function addToCart(householdId, { name, quantity, unit, pantry_item_id, source }) {
  const existing = await fetchCartItems(householdId)
  const key = cartLineKey({ pantry_item_id, name, unit })
  const match = existing.find((row) => cartLineKey(row) === key)

  if (match) {
    const { error } = await supabase
      .from('shopping_cart_items')
      .update({ quantity: Number(match.quantity) + Number(quantity) })
      .eq('id', match.id)
    if (error) throw error
    return match.id
  }

  const { data, error } = await supabase
    .from('shopping_cart_items')
    .insert({
      household_id: householdId,
      name: name.trim(),
      quantity: Number(quantity) || 1,
      unit,
      pantry_item_id: pantry_item_id || null,
      source: source || 'manual',
      is_checked: false,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function removeFromCart(cartItemId) {
  const { error } = await supabase.from('shopping_cart_items').delete().eq('id', cartItemId)
  if (error) throw error
}

export async function setCartItemChecked(cartItemId, checked) {
  const { error } = await supabase
    .from('shopping_cart_items')
    .update({ is_checked: checked })
    .eq('id', cartItemId)
  if (error) throw error
}

export async function updateCartItemQuantity(cartItemId, quantity) {
  const { error } = await supabase
    .from('shopping_cart_items')
    .update({ quantity: Math.max(0.01, Number(quantity) || 0) })
    .eq('id', cartItemId)
  if (error) throw error
}

export async function updateCartItem(cartItemId, { name, quantity, unit }) {
  const { error } = await supabase
    .from('shopping_cart_items')
    .update({
      name: name.trim(),
      quantity: Math.max(0.01, Number(quantity) || 0),
      unit,
    })
    .eq('id', cartItemId)
  if (error) throw error
}

async function addCartQuantityToPantry(cartItem) {
  if (cartItem.pantry_item_id) {
    const { data: item } = await supabase
      .from('pantry_items')
      .select('quantity')
      .eq('id', cartItem.pantry_item_id)
      .single()
    if (item) {
      const next = Number(item.quantity) + Number(cartItem.quantity)
      await supabase
        .from('pantry_items')
        .update({ quantity: next, updated_at: new Date().toISOString() })
        .eq('id', cartItem.pantry_item_id)
      return
    }
  }

  const { data: pantryRows } = await supabase
    .from('pantry_items')
    .select('id, quantity, name, unit')
    .eq('household_id', cartItem.household_id)

  const match = (pantryRows ?? []).find(
    (p) => normalizeName(p.name) === normalizeName(cartItem.name) && p.unit === cartItem.unit,
  )

  if (match) {
    const next = Number(match.quantity) + Number(cartItem.quantity)
    await supabase
      .from('pantry_items')
      .update({ quantity: next, updated_at: new Date().toISOString() })
      .eq('id', match.id)
  } else {
    await supabase.from('pantry_items').insert({
      household_id: cartItem.household_id,
      name: cartItem.name,
      quantity: Number(cartItem.quantity),
      unit: cartItem.unit,
    })
  }
}

export async function completeCartItem(cartItem) {
  await addCartQuantityToPantry(cartItem)
  await removeFromCart(cartItem.id)
}

export async function saveCheckedToPantry(checkedItems) {
  for (const item of checkedItems) {
    await addCartQuantityToPantry(item)
    await removeFromCart(item.id)
  }
}
