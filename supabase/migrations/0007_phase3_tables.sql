-- Phase 3 — DB schema expansion
-- Adds: game_history, trade_history, audit_log, achievements, user_achievements
-- Modifies: bug_report (adds consent_given), friendships (unique pair index)
-- Adds indexes for leaderboards and admin queries
-- Adds RLS policies

-- ──────────────────────────────────────────────────────────────────────────────
-- DB-6: bug_report consent column (SEC-13)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE bug_report
  ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────────────────────────
-- Friendships: unique pair index (SEC-14)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
  ON friendships (requester_id, addressee_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- DB-1: game_history
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_history (
  id                text PRIMARY KEY,
  room_id           text NOT NULL,
  host_user_id      text REFERENCES "user"(id) ON DELETE SET NULL,
  winner_user_id    text REFERENCES "user"(id) ON DELETE SET NULL,
  players           jsonb NOT NULL,
  final_net_worth   jsonb,
  started_at        timestamp NOT NULL,
  ended_at          timestamp NOT NULL DEFAULT NOW(),
  duration_minutes  integer NOT NULL DEFAULT 0,
  turns_played      integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS game_history_winner_idx ON game_history (winner_user_id);
CREATE INDEX IF NOT EXISTS game_history_host_idx ON game_history (host_user_id);
CREATE INDEX IF NOT EXISTS game_history_ended_idx ON game_history (ended_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- DB-2: trade_history
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_history (
  id            text PRIMARY KEY,
  game_id       text REFERENCES game_history(id) ON DELETE CASCADE,
  room_id       text NOT NULL,
  from_user_id  text REFERENCES "user"(id) ON DELETE SET NULL,
  to_user_id    text REFERENCES "user"(id) ON DELETE SET NULL,
  from_name     text NOT NULL DEFAULT '',
  to_name       text NOT NULL DEFAULT '',
  offered       jsonb NOT NULL,
  requested     jsonb NOT NULL,
  accepted      boolean NOT NULL DEFAULT false,
  created_at    timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trade_history_game_idx ON trade_history (game_id);
CREATE INDEX IF NOT EXISTS trade_history_from_idx ON trade_history (from_user_id);
CREATE INDEX IF NOT EXISTS trade_history_to_idx ON trade_history (to_user_id);
CREATE INDEX IF NOT EXISTS trade_history_created_idx ON trade_history (created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- DB-3: audit_log
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id             text PRIMARY KEY,
  admin_user_id  text REFERENCES "user"(id) ON DELETE SET NULL,
  action         text NOT NULL,
  target_type    text NOT NULL,
  target_id      text NOT NULL,
  before         jsonb,
  after          jsonb,
  ip_address     text,
  created_at     timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_admin_idx ON audit_log (admin_user_id);
CREATE INDEX IF NOT EXISTS audit_log_target_idx ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- DB-4: achievements + user_achievements
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  icon_url      text,
  reward_coins  integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id              text PRIMARY KEY,
  user_id         text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  achievement_id  text NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at     timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_achievements_user_idx ON user_achievements (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_user_ach_unique
  ON user_achievements (user_id, achievement_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Additional indexes
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS user_role_banned_idx ON "user" (role, banned);
CREATE INDEX IF NOT EXISTS user_stats_games_won_desc_idx ON user_stats (games_won DESC);
CREATE INDEX IF NOT EXISTS purchase_user_purchased_idx ON purchase (user_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ──────────────────────────────────────────────────────────────────────────────

-- game_history: public read (for leaderboards), server-only write
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_history_select ON game_history;
CREATE POLICY game_history_select ON game_history
  FOR SELECT USING (true);

-- trade_history: only participants can read
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trade_history_select_own ON trade_history;
CREATE POLICY trade_history_select_own ON trade_history
  FOR SELECT USING (
    auth.uid()::text = from_user_id OR auth.uid()::text = to_user_id
  );

-- audit_log: admin-only read
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_admin_read ON audit_log;
CREATE POLICY audit_log_admin_read ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "user"
      WHERE "user".id = auth.uid()::text AND "user".role = 'admin'
    )
  );

-- achievements: public read
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS achievements_select ON achievements;
CREATE POLICY achievements_select ON achievements
  FOR SELECT USING (true);

-- user_achievements: public read (for profile display), self-write only via server
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_achievements_select ON user_achievements;
CREATE POLICY user_achievements_select ON user_achievements
  FOR SELECT USING (true);

-- friendships: SEC-15 self-scoped read/write
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS friendships_select_own ON friendships;
CREATE POLICY friendships_select_own ON friendships
  FOR SELECT USING (
    auth.uid()::text = requester_id OR auth.uid()::text = addressee_id
  );
DROP POLICY IF EXISTS friendships_insert_own ON friendships;
CREATE POLICY friendships_insert_own ON friendships
  FOR INSERT WITH CHECK (auth.uid()::text = requester_id);
DROP POLICY IF EXISTS friendships_update_own ON friendships;
CREATE POLICY friendships_update_own ON friendships
  FOR UPDATE USING (
    auth.uid()::text = requester_id OR auth.uid()::text = addressee_id
  );

-- bug_report: no public reads (SEC-13); admin-only
ALTER TABLE bug_report ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bug_report_admin_read ON bug_report;
CREATE POLICY bug_report_admin_read ON bug_report
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "user"
      WHERE "user".id = auth.uid()::text AND "user".role = 'admin'
    )
  );

-- user_stats: public read (leaderboard), self-write only
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_stats_select ON user_stats;
CREATE POLICY user_stats_select ON user_stats
  FOR SELECT USING (true);
DROP POLICY IF EXISTS user_stats_update_own ON user_stats;
CREATE POLICY user_stats_update_own ON user_stats
  FOR UPDATE USING (auth.uid()::text = user_id);
