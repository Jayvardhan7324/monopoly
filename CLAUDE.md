# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cashly — a real-time multiplayer Monopoly-style board game. React 19 + TypeScript frontend, Express 5 + Socket.io backend, Postgres (Drizzle ORM) for persistence, Better Auth for accounts. Frontend and backend run from a **single `tsx server.ts` process**.

## Commands

```bash
npm run dev        # Dev server: Express + Socket.io + Vite middleware (HMR). http://localhost:3000
npm start          # Same entrypoint; serves built dist/ when NODE_ENV=production
npm run build      # vite build → dist/ (frontend only; the server always runs via tsx, never bundled)
npm run lint       # tsc --noEmit — the only type-check; run after any .ts/.tsx change
npm test           # tsx scripts/security-smoke-test.ts — assertion script exercising gameReducer
npm run db:push    # drizzle-kit push — apply db/schema.ts to the database (no migration files)
npm run db:generate# drizzle-kit generate — emit SQL migration into db/migrations
npm run db:seed    # tsx scripts/seed-store.ts — seed store_item rows
```

There is **no unit-test runner** (no Jest/Vitest). `npm test` is a single `node:assert` script — to test new reducer logic, add assertions to `scripts/security-smoke-test.ts`. `npm run dev` requires a reachable `DATABASE_URL` (and `BETTER_AUTH_SECRET`) or the server aborts with `[FATAL]` — see `.env.example`.

## Architecture: host-authoritative multiplayer

This is the single most important thing to understand. **`server.ts` is a relay/broker, not the game simulator.** The authoritative game logic lives in `services/gameReducer.ts` and runs inside **one player's browser — the host.** The server holds only room membership and the last-synced state snapshot (in-memory `RoomData`, not the DB).

Action flow for a non-host player:
1. Client emits `game_action` → server validates (rate limit, payload size/depth, `PLAYER_ALLOWED_ACTIONS` allowlist, turn ownership, actor-spoofing check) → relays to the host via `io.to(room.host).emit("host_process_action", …)`.
2. Host's `App.tsx` receives `host_process_action` and `dispatch`es it into `gameReducer`.
3. Host's resulting state change triggers `socket.emit("sync_state", { state })`; every non-host applies it via `dispatch({ type: 'SYNC_STATE' })`.

Consequences when editing game logic:
- **`services/actionPolicy.ts` (`PLAYER_ALLOWED_ACTIONS`) is a shared source of truth** imported by *both* `server.ts` (socket gate) and `App.tsx` (host gate). Any new action a non-host should be able to send **must** be added here or it is silently rejected.
- Anything authoritative — **bots, auction/votekick timers, bot trade resolution** — is host-only, guarded by `if (isOnline && !isHost) return` in `App.tsx`. Don't run these on every client.
- Reducer actions carry the actor's seat id; `actionSenderId`/`senderMatches` in `gameReducer.ts` reject actions submitted on behalf of another player. Preserve this when adding actions.
- **Host migration:** when the host disconnects the server promotes an "heir", emits `you_are_host`, and re-syncs. Disconnected players have a 5-minute reconnect window.
- Two distinct id spaces: `Player.id` is a **numeric seat index** (game state); socket ids and Better Auth `user.id` are **strings** (membership, DB). Don't conflate them.

### Game state machine

`services/gameReducer.ts` — pure `(GameState, Action) => GameState`. `GamePhase` (`ROLL → MOVING → RESOLVING → ACTION → TURN_END`, plus `AUCTION`) drives the turn loop. Exported `gameReducer` wraps `coreReducer` (which auto-chains follow-ups like rent payment). All game shapes live in `types.ts`; board tiles and card decks in `constants.ts`.

## Key files

- `server.ts` (~2200 lines) — Express REST (`/api/*`), Socket.io handlers, in-memory room registry, admin endpoints (`requireAdmin`). In dev it mounts Vite as middleware; in prod it serves `dist/`.
- `App.tsx` (~200KB) — root component; owns the `useReducer` game state, all Socket.io client wiring, host/guest branching, timers, and bot driving.
- `services/` — `gameReducer.ts` (rules), `botService.ts` (AI personalities), `socketService.ts` (client socket singleton), `actionPolicy.ts`, `audioService.ts`, `adsService.ts`.
- `lib/auth.ts` — Better Auth config (email/password + Google/Apple/Discord OAuth + admin plugin). `lib/auth-client.ts` is the React client.
- `db/schema.ts` — Drizzle schema (Better Auth core tables + store, stats, friends, game/trade history, ads, audit log). `db/index.ts` is the `pg` pool. `profiles` is a back-compat alias for `user`.
- `components/` — board/game UI plus feature folders (`admin`, `auth`, `store`, `friends`, `profile`, `settings`, `ui` = shadcn primitives).

## Auth & admin

Better Auth runs in-process at `/api/auth/*` — there is no external auth service or panel. The app's own admin dashboard is at `/__sys`, gated by `ADMIN_TOKEN`/`ADMIN_USERNAME`/`ADMIN_PASSWORD` (all three required or it's disabled). DB-level admin power comes from `user.role = 'admin'` (set via SQL). See `GUIDE.md` / `docs/DOKPLOY.md` for full deployment + env detail.

## Gotchas

- **Production drops all `console.*`** — `vite.config.ts` strips them from the client bundle (esbuild `drop`), and `server.ts`'s `log()` is a no-op when `NODE_ENV=production`. Use `console.error`/`console.warn` for anything that must appear in prod logs.
- `@/*` path alias maps to the repo root (`tsconfig.json` + `vite.config.ts`).
- `node_modules` is a symlink to `C:\Users\jayva\Downloads\monopoly\node_modules`.
- TS imports keep their `.ts`/`.tsx` extensions (`allowImportingTsExtensions`) since `tsx`/Vite resolve them directly.
