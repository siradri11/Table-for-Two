-- Table for Two — profiles, low stock, pantry photos, chef, shopping cart

-- Profiles (display names per user)
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pantry extensions
ALTER TABLE pantry_items
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
  ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Cook log chef attribution
ALTER TABLE cook_logs
  ADD COLUMN IF NOT EXISTS chef_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Shopping cart
CREATE TABLE shopping_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit unit_type NOT NULL DEFAULT 'pcs',
  pantry_item_id UUID REFERENCES pantry_items(id) ON DELETE SET NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shopping_cart_items_household_idx ON shopping_cart_items(household_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_cart_items ENABLE ROW LEVEL SECURITY;

-- Profiles: users read/update own row; household members can read each other's names
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT hm.user_id FROM household_members hm
      WHERE hm.household_id IN (SELECT user_household_ids())
    )
  );

CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Shopping cart
CREATE POLICY cart_all ON shopping_cart_items FOR ALL
  USING (household_id IN (SELECT user_household_ids()))
  WITH CHECK (household_id IN (SELECT user_household_ids()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_cart_items;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
