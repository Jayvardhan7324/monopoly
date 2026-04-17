# Monopoly (Cashly) — Codebase Context

## Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + framer-motion
- **Backend**: Express + Socket.io (single `server.ts`, no separate src/ dir)
- **Auth**: Supabase Auth (JWT Bearer tokens)
- **DB**: PostgreSQL via Drizzle ORM (`db/index.ts`, `db/schema.ts`)
- **AI**: Google Gemini 2.0 Flash — server-side proxy only at `/api/ai-advice`
- **Deployment**: nixpacks (`nixpacks.toml`), single process serves both API and static dist

## Entry Points
| File | Purpose |
|------|---------|
| `server.ts` | Express + Socket.io server — all API routes, room/game logic, admin, store |
| `index.tsx` | React app entry |
| `App.tsx` | Top-level router/layout |
| `vite.config.ts` | Vite config — no secrets exposed to client bundle |

## Key Directories
```
components/         React UI components
  admin/            Admin dashboard (BoardBuilder, Dashboard, AdminLogin)
  auth/             LoginPage (Supabase OAuth + email)
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
  index.ts          Drizzle client
  schema.ts         Tables: profiles, profilesStats, storeItem, purchase
supabase/migrations/0001_init.sql   DB schema
lib/
  auth-client.ts    Supabase client-side auth helpers
  auth.ts           Server-side auth helpers
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
| GET | `/api/store/items` | none | active store items |
| GET | `/api/store/inventory/:userId` | none | user purchases + coins |
| POST | `/api/store/purchase` | Bearer JWT | deduct coins, record purchase |
| GET | `/api/admin/users` | x-admin-token | list all profiles |
| PATCH | `/api/admin/users/:id` | x-admin-token | update role/ban/coins |
| GET/POST/PATCH/DELETE | `/api/admin/store/items*` | x-admin-token | store item management |
| GET | `/api/profile/:userId` | none | profile + stats |
| POST | `/api/profile/stats` | Bearer JWT | increment game stats |

### Socket.io Events
**Client → Server**: `join_session`, `update_player`, `start_game`, `kick_player`, `update_settings`, `leave_room`, `send_chat`, `game_action`, `sync_state`

**Server → Client**: `session_rejected`, `you_are_host`, `room_updated`, `game_started`, `sync_state`, `kicked`, `settings_updated`, `chat_message`, `action_error`, `host_process_action`, `rooms_list`, `admin_board_pushed`

**Rate limits**: 10 actions/sec per socket for `game_action`/`send_chat`; 10 joins/min per IP for join endpoints; 5 req/min per IP for `/api/ai-advice`

### Action allowlist (SEC-05)
Non-host players may only submit: `ROLL_DICE`, `BUY_PROPERTY`, `ATTEMPT_JAIL_ROLL`, `SKIP_JAIL_TURN`, `PAY_JAIL_FINE`, `MORTGAGE_PROPERTY`, `UNMORTGAGE_PROPERTY`, `UPGRADE_PROPERTY`, `DOWNGRADE_PROPERTY`, `SELL_PROPERTY`, `PROPOSE_TRADE`, `ACCEPT_TRADE`, `DECLINE_TRADE`, `CANCEL_TRADE`, `PLACE_BID`, `END_TURN`, `DECLARE_BANKRUPT`, `VOTE_KICK`, `CANCEL_VOTE_KICK`

## Environment Variables
```
# Required for DB/auth features
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Client-side (Vite VITE_ prefix)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

# Admin panel — all three must be set or admin is disabled
ADMIN_TOKEN          # Bearer token for x-admin-token header
ADMIN_USERNAME
ADMIN_PASSWORD

# App
PORT                 # default 3000
NODE_ENV             # production = silent logs
ALLOWED_ORIGINS      # comma-separated, default allows all in dev

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
- `profiles` — id, name, email, image, role, banned, banReason, coins, createdAt
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

All tables have RLS enabled (public-read for leaderboards/active board, admin-only for audit/bug_report, self-scoped for friendships/trades).

## Build & Dev
```bash
npm run dev      # starts Vite dev server + Express (NODE_ENV != production path)
npm run build    # vite build → dist/
npm start        # NODE_ENV=production, serves dist/ as static
```
In production, Express serves `dist/` as static files with SPA fallback to `index.html`.
