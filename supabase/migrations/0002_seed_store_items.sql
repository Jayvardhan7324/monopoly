-- Seed default store items for Cashly
INSERT INTO store_item (id, name, description, type, price_coins, asset_url, active, created_at)
VALUES
  (
    gen_random_uuid(),
    'Gold Token',
    'A shiny gold game piece that makes every move feel like a win.',
    'token',
    500,
    NULL,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'Diamond Token',
    'The rarest token on the board. Reserved for true Cashly elites.',
    'token',
    1500,
    NULL,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'Midnight Board',
    'A sleek dark-themed board with deep navy streets and gold accents.',
    'board_skin',
    1000,
    NULL,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'Tropical Paradise Board',
    'Turquoise streets and palm tree vibes. Buy properties in style.',
    'board_skin',
    2000,
    NULL,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'Neon Avatar Frame',
    'Wrap your avatar in glowing neon — hard to miss at the table.',
    'avatar',
    300,
    NULL,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'VIP Crown Avatar',
    'A golden crown overlay that screams big landlord energy.',
    'avatar',
    750,
    NULL,
    true,
    now()
  ),
  (
    gen_random_uuid(),
    'Cashly Pass',
    'Monthly cosmetic unlock badge. Flex your loyalty to the game.',
    'misc',
    250,
    NULL,
    true,
    now()
  )
ON CONFLICT (id) DO NOTHING;
