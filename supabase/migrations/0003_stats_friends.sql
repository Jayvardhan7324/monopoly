-- Add new stat columns to user_stats
ALTER TABLE user_stats
  ADD COLUMN IF NOT EXISTS games_lost         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peak_properties_owned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bankruptcies       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_turns        integer NOT NULL DEFAULT 0;

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id           text PRIMARY KEY,
  requester_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  addressee_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id);
