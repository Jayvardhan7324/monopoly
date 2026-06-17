-- Persistent admin board storage (two-way DB sync)
-- Ensures saved boards survive server restarts.

CREATE TABLE IF NOT EXISTS admin_board (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       text NOT NULL,
  board_size integer NOT NULL DEFAULT 40,
  tiles      jsonb NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_board_active_idx ON admin_board (is_active);
CREATE INDEX IF NOT EXISTS admin_board_created_idx ON admin_board (created_at DESC);

-- Only one board can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS admin_board_single_active_uniq
  ON admin_board ((1)) WHERE is_active = true;

ALTER TABLE admin_board ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_board_select ON admin_board;
CREATE POLICY admin_board_select ON admin_board FOR SELECT USING (true);

-- Also ensure bug_report has the required columns & id default
ALTER TABLE bug_report ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE bug_report ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false;
ALTER TABLE bug_report ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
