-- ── Profiles (linked to Supabase auth.users) ──────────────────────────────────
CREATE TABLE public.profiles (
  id           TEXT PRIMARY KEY,                   -- = auth.users.id (UUID)
  name         TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  image        TEXT,
  role         TEXT NOT NULL DEFAULT 'user',
  banned       BOOLEAN NOT NULL DEFAULT false,
  ban_reason   TEXT,
  ban_expires  TIMESTAMP WITH TIME ZONE,
  coins        INTEGER NOT NULL DEFAULT 500,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Store items ────────────────────────────────────────────────────────────────
CREATE TABLE public.store_item (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL,
  price_coins  INTEGER NOT NULL DEFAULT 100,
  asset_url    TEXT,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Purchases ──────────────────────────────────────────────────────────────────
CREATE TABLE public.purchase (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL REFERENCES public.store_item(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Player stats ───────────────────────────────────────────────────────────────
CREATE TABLE public.user_stats (
  user_id           TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  games_played      INTEGER NOT NULL DEFAULT 0,
  games_won         INTEGER NOT NULL DEFAULT 0,
  total_earnings    INTEGER NOT NULL DEFAULT 0,
  properties_bought INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ── Trigger: auto-create profile on new Supabase auth user ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, created_at, updated_at)
  VALUES (
    NEW.id::TEXT,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── RLS policies ───────────────────────────────────────────────────────────────
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, user can update own
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid()::TEXT = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid()::TEXT = id);

-- Store items: public read of active items
CREATE POLICY "store_item_select" ON public.store_item FOR SELECT USING (active = true);

-- Purchases: user sees own
CREATE POLICY "purchase_select" ON public.purchase FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "purchase_insert" ON public.purchase FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);

-- Stats: public read
CREATE POLICY "user_stats_select" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "user_stats_upsert" ON public.user_stats FOR ALL USING (auth.uid()::TEXT = user_id);
