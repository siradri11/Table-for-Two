-- Table for Two — UX v2: preparation steps, manual history, cart checked, household merge join

-- Recipe preparation steps (mirrors recipe_steps)
CREATE TABLE recipe_preparation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  prep_number INT NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  UNIQUE (recipe_id, prep_number)
);

ALTER TABLE recipe_preparation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_prep_all ON recipe_preparation_steps FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())))
  WITH CHECK (recipe_id IN (SELECT id FROM recipes WHERE household_id IN (SELECT user_household_ids())));

-- Manual meal history (no recipe required)
ALTER TABLE cook_logs ALTER COLUMN recipe_id DROP NOT NULL;
ALTER TABLE cook_logs ADD COLUMN IF NOT EXISTS title TEXT;

-- Shopping cart checked state
ALTER TABLE shopping_cart_items
  ADD COLUMN IF NOT EXISTS is_checked BOOLEAN NOT NULL DEFAULT false;

-- Join household with optional merge of solo pantry/recipes
CREATE OR REPLACE FUNCTION join_household_with_merge(p_invite_code TEXT, p_merge BOOLEAN DEFAULT false)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id UUID;
  v_solo_id UUID;
  v_member_count INT;
  v_pantry_map JSONB := '{}'::JSONB;
  v_old_pantry RECORD;
  v_existing_id UUID;
  v_new_pantry_id UUID;
  v_old_recipe RECORD;
  v_new_recipe_id UUID;
  v_old_ing RECORD;
  v_old_step RECORD;
  v_old_prep RECORD;
  v_old_tag RECORD;
BEGIN
  SELECT id INTO v_target_id
  FROM households
  WHERE upper(invite_code) = upper(trim(p_invite_code));

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- User's current household (first membership)
  SELECT hm.household_id INTO v_solo_id
  FROM household_members hm
  WHERE hm.user_id = auth.uid()
  LIMIT 1;

  IF v_solo_id IS NULL THEN
    RAISE EXCEPTION 'You are not in a household yet';
  END IF;

  IF v_solo_id = v_target_id THEN
    RAISE EXCEPTION 'You are already in this kitchen';
  END IF;

  SELECT count(*)::INT INTO v_member_count
  FROM household_members
  WHERE household_id = v_solo_id;

  IF v_member_count > 1 THEN
    RAISE EXCEPTION 'Leave your shared kitchen first — join is only available when you are the only member';
  END IF;

  IF p_merge THEN
    -- Copy pantry items; merge qty when same lower(name) + unit exists in target
    FOR v_old_pantry IN
      SELECT * FROM pantry_items WHERE household_id = v_solo_id
    LOOP
      SELECT id INTO v_existing_id
      FROM pantry_items
      WHERE household_id = v_target_id
        AND lower(trim(name)) = lower(trim(v_old_pantry.name))
        AND unit = v_old_pantry.unit
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        UPDATE pantry_items
        SET quantity = quantity + v_old_pantry.quantity,
            updated_at = now()
        WHERE id = v_existing_id;
        v_new_pantry_id := v_existing_id;
      ELSE
        INSERT INTO pantry_items (household_id, name, quantity, unit, notes, low_stock_threshold, image_path)
        VALUES (
          v_target_id,
          v_old_pantry.name,
          v_old_pantry.quantity,
          v_old_pantry.unit,
          v_old_pantry.notes,
          v_old_pantry.low_stock_threshold,
          v_old_pantry.image_path
        )
        RETURNING id INTO v_new_pantry_id;
      END IF;

      v_pantry_map := v_pantry_map || jsonb_build_object(v_old_pantry.id::TEXT, v_new_pantry_id::TEXT);
    END LOOP;

    -- Copy recipes and children
    FOR v_old_recipe IN
      SELECT * FROM recipes WHERE household_id = v_solo_id
    LOOP
      INSERT INTO recipes (household_id, name, description, cover_image_path, created_at, updated_at)
      VALUES (
        v_target_id,
        v_old_recipe.name,
        v_old_recipe.description,
        v_old_recipe.cover_image_path,
        v_old_recipe.created_at,
        now()
      )
      RETURNING id INTO v_new_recipe_id;

      FOR v_old_ing IN
        SELECT * FROM recipe_ingredients WHERE recipe_id = v_old_recipe.id ORDER BY sort_order
      LOOP
        INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order, pantry_item_id)
        VALUES (
          v_new_recipe_id,
          v_old_ing.name,
          v_old_ing.quantity,
          v_old_ing.unit,
          v_old_ing.sort_order,
          CASE
            WHEN v_old_ing.pantry_item_id IS NOT NULL
              AND v_pantry_map ? v_old_ing.pantry_item_id::TEXT
            THEN (v_pantry_map ->> v_old_ing.pantry_item_id::TEXT)::UUID
            ELSE NULL
          END
        );
      END LOOP;

      FOR v_old_step IN
        SELECT * FROM recipe_steps WHERE recipe_id = v_old_recipe.id ORDER BY step_number
      LOOP
        INSERT INTO recipe_steps (recipe_id, step_number, instruction, image_path)
        VALUES (v_new_recipe_id, v_old_step.step_number, v_old_step.instruction, v_old_step.image_path);
      END LOOP;

      FOR v_old_prep IN
        SELECT * FROM recipe_preparation_steps WHERE recipe_id = v_old_recipe.id ORDER BY prep_number
      LOOP
        INSERT INTO recipe_preparation_steps (recipe_id, prep_number, instruction, image_path)
        VALUES (v_new_recipe_id, v_old_prep.prep_number, v_old_prep.instruction, v_old_prep.image_path);
      END LOOP;

      FOR v_old_tag IN
        SELECT tag_id FROM recipe_tags WHERE recipe_id = v_old_recipe.id
      LOOP
        INSERT INTO recipe_tags (recipe_id, tag_id)
        VALUES (v_new_recipe_id, v_old_tag.tag_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  -- Remove solo household (cascade deletes all solo data)
  DELETE FROM household_members WHERE household_id = v_solo_id AND user_id = auth.uid();
  DELETE FROM households WHERE id = v_solo_id
    AND NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = v_solo_id);

  -- Join target
  INSERT INTO household_members (household_id, user_id)
  VALUES (v_target_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN v_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION join_household_with_merge(TEXT, BOOLEAN) TO authenticated;
