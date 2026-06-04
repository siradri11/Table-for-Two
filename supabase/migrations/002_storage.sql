-- Storage bucket for recipe images
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path must start with household_id user belongs to
CREATE POLICY "recipe_images_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-images');

CREATE POLICY "recipe_images_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_household_ids())
);

CREATE POLICY "recipe_images_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_household_ids())
);

CREATE POLICY "recipe_images_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1]::uuid IN (SELECT user_household_ids())
);

-- RPC grants
GRANT EXECUTE ON FUNCTION create_household(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION join_household(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_household_ids() TO authenticated;
