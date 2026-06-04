-- Table for Two — initial schema

-- Enums
CREATE TYPE tag_category AS ENUM ('pantry', 'recipe');
CREATE TYPE unit_type AS ENUM ('g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'cup');
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- Households
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Our Kitchen',
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE household_members (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#F5D5D5',
  category tag_category NOT NULL,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, name, category)
);

-- Pantry
CREATE TABLE pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit unit_type NOT NULL DEFAULT 'g',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pantry_item_tags (
  pantry_item_id UUID NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (pantry_item_id, tag_id)
);

-- Recipes
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe_tags (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit unit_type NOT NULL DEFAULT 'g',
  sort_order INT NOT NULL DEFAULT 0,
  pantry_item_id UUID REFERENCES pantry_items(id) ON DELETE SET NULL
);

CREATE TABLE recipe_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  instruction TEXT NOT NULL,
  image_path TEXT,
  UNIQUE (recipe_id, step_number)
);

-- Cook logs
CREATE TABLE cook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  cooked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meal_type meal_type NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE cook_log_ingredient_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_log_id UUID NOT NULL REFERENCES cook_logs(id) ON DELETE CASCADE,
  pantry_item_id UUID REFERENCES pantry_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  unit unit_type NOT NULL DEFAULT 'g'
);

-- Meal plans
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  meal_type meal_type NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  UNIQUE (household_id, plan_date, meal_type)
);

-- Helper: user household ids
CREATE OR REPLACE FUNCTION user_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid();
$$;

-- Seed preset tags for a household
CREATE OR REPLACE FUNCTION seed_household_tags(p_household_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO tags (household_id, name, color, category, is_preset) VALUES
    (p_household_id, 'Meat', '#E8A0A0', 'pantry', true),
    (p_household_id, 'Vegetables', '#A8D5A2', 'pantry', true),
    (p_household_id, 'Fruits', '#FFD89B', 'pantry', true),
    (p_household_id, 'Seafood', '#9EC5E8', 'pantry', true),
    (p_household_id, 'Seasoning', '#D4C4A8', 'pantry', true),
    (p_household_id, 'Pork', '#E8A0A0', 'recipe', true),
    (p_household_id, 'Chicken', '#F5D5A5', 'recipe', true),
    (p_household_id, 'Vegan', '#A8D5A2', 'recipe', true),
    (p_household_id, 'Fish', '#9EC5E8', 'recipe', true),
    (p_household_id, 'Breakfast', '#FFD89B', 'recipe', true),
    (p_household_id, 'Lunch', '#F5D5D5', 'recipe', true),
    (p_household_id, 'Dinner', '#D4A5A5', 'recipe', true)
  ON CONFLICT (household_id, name, category) DO NOTHING;
END;
$$;

-- Create household (callable by authenticated user)
CREATE OR REPLACE FUNCTION create_household(p_name TEXT DEFAULT 'Our Kitchen')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_code TEXT;
BEGIN
  v_code := upper(substr(md5(random()::text), 1, 8));
  INSERT INTO households (name, invite_code) VALUES (p_name, v_code) RETURNING id INTO v_id;
  INSERT INTO household_members (household_id, user_id, role) VALUES (v_id, auth.uid(), 'owner');
  PERFORM seed_household_tags(v_id);
  RETURN v_id;
END;
$$;

-- Join household by invite code
CREATE OR REPLACE FUNCTION join_household(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM households WHERE upper(invite_code) = upper(trim(p_invite_code));
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  INSERT INTO household_members (household_id, user_id) VALUES (v_id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN v_id;
END;
$$;

-- RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cook_log_ingredient_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Households
CREATE POLICY households_select ON households FOR SELECT
  USING (id IN (SELECT user_household_ids()));
CREATE POLICY households_insert ON households FOR INSERT
  WITH CHECK (true);
CREATE POLICY households_update ON households FOR UPDATE
  USING (id IN (SELECT user_household_ids()));

-- Members
CREATE POLICY members_select ON household_members FOR SELECT
  USING (household_id IN (SELECT user_household_ids()) OR user_id = auth.uid());
CREATE POLICY members_insert ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR household_id IN (SELECT user_household_ids()));

-- Tags
CREATE POLICY tags_all ON tags FOR ALL
  USING (household_id IN (SELECT user_household_ids()))
  WITH CHECK (household_id IN (SELECT user_household_ids()));

-- Pantry items
CREATE POLICY pantry_select ON pantry_items FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));
CREATE POLICY pantry_insert ON pantry_items FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));
CREATE POLICY pantry_update ON pantry_items FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));
CREATE POLICY pantry_delete ON pantry_items FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));

-- Pantry item tags
CREATE POLICY pit_select ON pantry_item_tags FOR SELECT
  USING (pantry_item_id IN (SELECT id FROM pantry_items WHERE household_id IN (SELECT user_household_ids())));
CREATE POLICY pit_all ON pantry_item_tags FOR ALL
  USING (pantry_item_id IN (SELECT id FROM pantry_items WHERE household_id IN (SELECT user_household_ids())))
  WITH CHECK (pantry_item_id IN (SELECT id FROM pantry_items WHERE household_id IN (SELECT user_household_ids())));

-- Recipes
CREATE POLICY recipes_all ON recipes FOR ALL
  USING (household_id IN (SELECT user_household_ids()))
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY recipe_tags_all ON recipe_tags FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())))
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())));

CREATE POLICY recipe_ing_all ON recipe_ingredients FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())))
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())));

CREATE POLICY recipe_steps_all ON recipe_steps FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())))
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())));

-- Cook logs
CREATE POLICY cook_logs_all ON cook_logs FOR ALL
  USING (household_id IN (SELECT user_household_ids()))
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY cook_usage_all ON cook_log_ingredient_usage FOR ALL
  USING (cook_log_id IN (SELECT id FROM cook_logs WHERE household_id IN (SELECT user_household_ids())))
  WITH CHECK (cook_log_id IN (SELECT id FROM cook_logs WHERE household_id IN (SELECT user_household_ids())));

-- Meal plans
CREATE POLICY meal_plans_all ON meal_plans FOR ALL
  USING (household_id IN (SELECT user_household_ids()))
  WITH CHECK (household_id IN (SELECT user_household_ids()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pantry_items;
ALTER PUBLICATION supabase_realtime ADD TABLE recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE cook_logs;

-- Storage bucket (run in dashboard or via SQL if storage extension available)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images', 'recipe-images', true);
