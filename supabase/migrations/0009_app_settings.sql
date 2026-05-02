-- Global app settings persisted through Postgres.
-- Admin writes go through the server; public clients can read selected config.

CREATE TABLE IF NOT EXISTS app_setting (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamp NOT NULL DEFAULT NOW()
);

ALTER TABLE app_setting ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_setting_select ON app_setting;
CREATE POLICY app_setting_select ON app_setting FOR SELECT USING (true);

INSERT INTO app_setting (key, value, updated_at)
VALUES (
  'visual_settings',
  '{
    "particleCount": 120,
    "particleSpeed": 1,
    "particleSize": 1,
    "particleOpacity": 0.7,
    "particleFadeZone": 0.28,
    "glowOpacity": 0.65,
    "glowWidth": 960,
    "glowHeight": 520,
    "glowY": -180,
    "particleShape": "circle"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;
