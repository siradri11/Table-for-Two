-- Table for Two — concept overhaul: URL recipes, meal diary, disconnect pantry from recipes/plan

-- Simplified recipes (URL bookmarks + optional scraped content)
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS scraped_content TEXT,
  ADD COLUMN IF NOT EXISTS is_bookmark BOOLEAN NOT NULL DEFAULT false;

-- Meal diary (Plan tab — freestyle notes per day/slot)
CREATE TABLE IF NOT EXISTS meal_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  diary_date DATE NOT NULL,
  meal_type meal_type NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, diary_date, meal_type)
);

CREATE INDEX IF NOT EXISTS meal_diary_household_date_idx ON meal_diary(household_id, diary_date);

ALTER TABLE meal_diary ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_diary_all ON meal_diary FOR ALL
  USING (household_id IN (SELECT user_household_ids()))
  WITH CHECK (household_id IN (SELECT user_household_ids()));

ALTER PUBLICATION supabase_realtime ADD TABLE meal_diary;

-- Simplified household merge: copy bookmark recipes only
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
  v_old_tag RECORD;
BEGIN
  SELECT id INTO v_target_id
  FROM households
  WHERE upper(invite_code) = upper(trim(p_invite_code));

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

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

    FOR v_old_recipe IN
      SELECT * FROM recipes WHERE household_id = v_solo_id
    LOOP
      INSERT INTO recipes (
        household_id, name, description, source_url, scraped_content, is_bookmark, created_at, updated_at
      )
      VALUES (
        v_target_id,
        v_old_recipe.name,
        v_old_recipe.description,
        v_old_recipe.source_url,
        v_old_recipe.scraped_content,
        COALESCE(v_old_recipe.is_bookmark, false),
        v_old_recipe.created_at,
        now()
      )
      RETURNING id INTO v_new_recipe_id;

      FOR v_old_tag IN
        SELECT tag_id FROM recipe_tags WHERE recipe_id = v_old_recipe.id
      LOOP
        INSERT INTO recipe_tags (recipe_id, tag_id)
        VALUES (v_new_recipe_id, v_old_tag.tag_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  DELETE FROM household_members WHERE household_id = v_solo_id AND user_id = auth.uid();
  DELETE FROM households WHERE id = v_solo_id
    AND NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = v_solo_id);

  INSERT INTO household_members (household_id, user_id)
  VALUES (v_target_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN v_target_id;
END;
$$;
