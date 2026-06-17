-- Better Auth core user tables plus app economy/store tables.
CREATE TABLE public."user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  role text DEFAULT 'user',
  banned boolean DEFAULT false,
  ban_reason text,
  ban_expires timestamptz,
  coins integer NOT NULL DEFAULT 500,
  equipped_avatar_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.session (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  impersonated_by text
);

CREATE INDEX session_user_id_idx ON public.session(user_id);
CREATE INDEX session_token_idx ON public.session(token);

CREATE TABLE public.account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_user_id_idx ON public.account(user_id);
CREATE UNIQUE INDEX account_provider_account_unique ON public.account(provider_id, account_id);

CREATE TABLE public.verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verification_identifier_idx ON public.verification(identifier);

CREATE TABLE public.store_item (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL,
  price_coins integer NOT NULL DEFAULT 100,
  asset_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.store_item(id) ON DELETE CASCADE,
  purchased_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_user_id_idx ON public.purchase(user_id);
CREATE UNIQUE INDEX purchase_user_item_unique ON public.purchase(user_id, item_id);

CREATE TABLE public.user_stats (
  user_id text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  games_played integer NOT NULL DEFAULT 0,
  games_won integer NOT NULL DEFAULT 0,
  total_earnings integer NOT NULL DEFAULT 0,
  properties_bought integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_select_public ON public."user"
  FOR SELECT USING (true);
CREATE POLICY user_update_own ON public."user"
  FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY store_item_select ON public.store_item
  FOR SELECT USING (active = true);

CREATE POLICY purchase_select_own ON public.purchase
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY user_stats_select ON public.user_stats
  FOR SELECT USING (true);
