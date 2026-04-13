-- Add equipped_avatar_item_id to profiles
-- Tracks which store profile_pic item a user has equipped (null = not equipped)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS equipped_avatar_item_id text
  REFERENCES store_item(id) ON DELETE SET NULL;
