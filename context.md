# Monopoly (Cashly) — Codebase Context

## Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + framer-motion
- **Backend**: Express + Socket.io (single `server.ts`, no separate src/ dir)
- **Auth**: Better Auth (cookie sessions, email+password with email verification + Google + Apple + Discord) mounted at `/api/auth/*`
- **DB**: PostgreSQL via Drizzle ORM (`db/index.ts`, `db/schema.ts`) — Dokploy-hosted in prod, local Docker Postgres in dev
- **AI**: Google Gemini 2.0 Flash — server-side proxy only at `/api/ai-advice`
- **Deployment**: Dokploy — Postgres as a managed database service, app as a Node/nixpacks application service

## Entry Points
| File | Purpose |
|------|---------|
| `server.ts` | Express + Socket.io server — all API routes, room/game logic, admin, store |
| `index.tsx` | React app entry |
| `App.tsx` | Top-level router/layout |
| `vite.config.ts` | Vite config — no secrets exposed to client bundle |
| `lib/auth.ts` | Better Auth server instance (Drizzle adapter, Google/Apple/email, admin plugin) |
| `lib/auth-client.ts` | Better Auth React client + `authFetch` wrapper (cookie-credentialed) |

## Key Directories
```
components/         React UI components
  admin/            Admin dashboard (BoardBuilder, Dashboard, AdminLogin)
  auth/             LoginPage (Better Auth: Google / Apple / email+password)
  store/            StorePage (coin purchases)
  profile/          ProfileModal
  ui/               shadcn base components
services/           Client-side logic
  gameReducer.ts    All game state transitions (ROLL_DICE, BUY_PROPERTY, etc.)
  botService.ts     AI bot logic (has TypeScript errors — Tile[][][] type issues)
  geminiService.ts  Calls /api/ai-advice proxy (never calls Gemini directly)
  socketService.ts  Socket.io client wrapper
  audioService.ts   Sound effects
db/
  index.ts          Drizzle client (node-postgres pool)
  schema.ts         Better Auth core + app tables (see DB Schema section below)
lib/
  auth-client.ts    Better Auth React client + authFetch wrapper
  auth.ts           Better Auth server instance
  dice3d.ts         3D dice animation
cashly_assets/      Static images + sounds served at /sounds
```

## Server Architecture (`server.ts`)

### Room lifecycle
- Rooms stored in-memory `Map<string, RoomData>` — **no persistence**
- Room IDs: 6-char hex (CSPRNG), Player IDs: `p_` + 16-char UUID fragment
- States: lobby → game in progress → all disconnected (idle TTL 10min)
- Reconnect window: 5 min per player; GC runs every 15 min

### REST API
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/health` | none | |
| GET | `/api/rooms` | none | public lobby list |
| POST | `/api/rooms` | none | create room |
| POST | `/api/rooms/random` | none | join or create |
| POST | `/api/rooms/:id/join` | none | join specific room |
| POST | `/api/ai-advice` | none | Gemini proxy, 5 req/min/IP |
| GET | `/api/active-board` | none | currently pushed admin board |
| POST | `/api/admin/login` | none → returns token | needs ADMIN_USERNAME/PASSWORD env vars |
| GET/POST/PUT/DELETE | `/api/admin/boards*` | x-admin-token header | board CRUD |
| POST | `/api/admin/boards/:id/push` | x-admin-token | push board to all clients |
| POST | `/api/admin/db-test` | x-admin-token | exercise connect/read/write/tx + per-table row counts |
| GET | `/api/store/items` | none | active store items |
| GET | `/api/store/inventory/:userId` | none | user purchases + coins |
| POST | `/api/store/purchase` | session cookie | deduct coins, record purchase |
| GET | `/api/admin/users` | x-admin-token | list all users |
| PATCH | `/api/admin/users/:id` | x-admin-token | update role/ban/coins |
| GET/POST/PATCH/DELETE | `/api/admin/store/items*` | x-admin-token | store item management |
| ALL | `/api/auth/*` | handled by Better Auth | sign-in / sign-up / OAuth / sign-out / session |
| GET | `/api/profile/:userId` | none | profile + stats |
| POST | `/api/profile/stats` | session cookie | increment game stats |

### Socket.io Events
**Client → Server**: `join_session`, `update_player`, `start_game`, `kick_player`, `update_settings`, `leave_room`, `send_chat`, `game_action`, `sync_state`

**Server → Client**: `session_rejected`, `you_are_host`, `room_updated`, `game_started`, `sync_state`, `kicked`, `settings_updated`, `chat_message`, `action_error`, `host_process_action`, `rooms_list`, `admin_board_pushed`

**Rate limits**: 10 actions/sec per socket for `game_action`/`send_chat`; 10 joins/min per IP for join endpoints; 5 req/min per IP for `/api/ai-advice`

### Action allowlist (SEC-05)
Non-host players may only submit: `ROLL_DICE`, `BUY_PROPERTY`, `ATTEMPT_JAIL_ROLL`, `SKIP_JAIL_TURN`, `PAY_JAIL_FINE`, `MORTGAGE_PROPERTY`, `UNMORTGAGE_PROPERTY`, `UPGRADE_PROPERTY`, `DOWNGRADE_PROPERTY`, `SELL_PROPERTY`, `PROPOSE_TRADE`, `ACCEPT_TRADE`, `DECLINE_TRADE`, `CANCEL_TRADE`, `PLACE_BID`, `END_TURN`, `DECLARE_BANKRUPT`, `VOTE_KICK`, `CANCEL_VOTE_KICK`

## Environment Variables
```
# Required (server fails to start without these)
DATABASE_URL          # Postgres connection string
BETTER_AUTH_SECRET    # random 32-byte secret — signs session cookies

# Better Auth
BETTER_AUTH_URL       # public URL of the app (used for OAuth callbacks)

# OAuth providers (optional — each provider auto-disables if both vars are empty)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APPLE_CLIENT_ID
APPLE_CLIENT_SECRET
APPLE_APP_BUNDLE_ID
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET

# Email verification (Resend HTTP API — no extra deps)
RESEND_API_KEY              # if unset, verify links log to console (dev)
EMAIL_FROM                  # default "Cashly <onboarding@resend.dev>"
REQUIRE_EMAIL_VERIFICATION  # "true" blocks sign-in until verified

# Admin panel — all three must be set or admin is disabled
ADMIN_TOKEN          # Bearer token for x-admin-token header
ADMIN_USERNAME
ADMIN_PASSWORD

# App
PORT                 # default 3000
NODE_ENV             # production = silent logs
ALLOWED_ORIGINS      # comma-separated — also doubles as Better Auth trustedOrigins

# AI (optional)
GEMINI_API_KEY       # server-side only, never in Vite bundle
```

## Security Controls (already implemented)
- CSPRNG IDs (randomBytes / randomUUID) — SEC-08/09
- CORS origin allowlist — SEC-01
- Admin token header auth — SEC-01
- Action type allowlist — SEC-05
- Gemini key server-proxy only — SEC-07
- Chat message size limit (500 chars) — NET-07
- Socket.io state payload limit (512KB) — B5
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- Per-IP rate limits on joins and AI advice

## Known Issues / Tech Debt
- `services/botService.ts` has 18+ TypeScript type errors (Tile[] vs Tile[][][] dimension mismatch)
- `console.error` / `console.warn` still fire in production (intentional — errors should be visible)
- No structured logging (no Winston/Pino) — stdout only
- No test coverage (zero project test files)
- Admin board state is in-memory — lost on server restart
- No DB connection pooling config visible

## DB Schema (Drizzle / Postgres)
Better Auth core tables:
- `user` — id, name, email, emailVerified, image, role, banned, banReason, banExpires, coins, equippedAvatarItemId, createdAt, updatedAt (replaces the old Supabase-backed `profiles` table; exported both as `schema.user` and the back-compat alias `schema.profiles`)
- `session` — id, expiresAt, token, ipAddress, userAgent, userId, impersonatedBy
- `account` — OAuth linkages + hashed password for email/password accounts
- `verification` — email/phone verification tokens
- `profilesStats` (user_stats) — userId, gamesPlayed/Won/Lost, totalEarnings, propertiesBought, peakPropertiesOwned, bankruptcies, totalTurns
- `storeItem` — id, name, description, type, priceCoins, assetUrl, active, createdAt
- `purchase` — id, userId, itemId, purchasedAt
- `bugReport` — id (gen_random_uuid default), title, description, imageUrl, consentGiven, status, ip, userAgent, createdAt
- `friendships` — id, requesterId, addresseeId, status
- `adminBoard` — id, name, boardSize, tiles (jsonb), isActive, createdAt, updatedAt (persistent board templates)
- `gameHistory` — id, roomId, hostUserId, winnerUserId, players, finalNetWorth, startedAt, endedAt, durationMinutes, turnsPlayed
- `tradeHistory` — id, gameId, roomId, fromUserId, toUserId, offered, requested, accepted, createdAt
- `auditLog` — id, adminUserId, action, targetType, targetId, before, after, ipAddress, createdAt
- `achievements` / `userAchievements` — slug-keyed achievements + user unlocks

RLS is not used — the app is the sole DB client and gates access at the API layer (session cookie + `requireAdmin`).

## Build & Dev
```bash
npm run dev          # starts Express+Vite in dev
npm run build        # vite build → dist/
npm start            # NODE_ENV=production, serves dist/ as static
npm run db:push      # drizzle-kit push — syncs db/schema.ts to DATABASE_URL
npm run db:generate  # drizzle-kit generate — generate migration SQL
```
In production, Express serves `dist/` as static files with SPA fallback to `index.html`.

## Deployment (Dokploy)
See `docs/DOKPLOY.md` for the full step-by-step. Short version:
1. Dokploy → **Databases** → Create **Postgres** → copy the internal connection string.
2. Dokploy → **Applications** → Create app → point at this Git repo → set env vars (`DATABASE_URL` using the internal connection string, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, OAuth creds, admin creds, `ALLOWED_ORIGINS`).
3. Deploy. First-boot: run `npm run db:push` once (either via Dokploy shell or as a pre-deploy command) to create Better Auth + app tables.
4. Admin → Overview → **Run DB Test** to verify connect/read/write/tx.
