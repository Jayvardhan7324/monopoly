-- Bug reports table
CREATE TABLE IF NOT EXISTS bug_report (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  description text NOT NULL,
  ip          text,
  user_agent  text,
  status      text NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_report_status_idx     ON bug_report(status);
CREATE INDEX IF NOT EXISTS bug_report_created_at_idx ON bug_report(created_at);
