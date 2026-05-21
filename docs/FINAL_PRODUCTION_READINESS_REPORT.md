# Final Production Readiness Report

Date: 2026-05-14
Project: Cashly / Monopoly browser game
Scope: security, dependency advisories, auth resilience, UI and animation, multiplayer/game logic, deployment checks, and a multi-week final-check plan.

## Executive Status

Status: Not ready for a final production launch yet.

The app is in a strong late-stage state: typechecking passes, the production build passes, the existing security smoke test passes, socket/game-action gates are much better than a typical browser-hosted game, and the server has meaningful CSP, payload, CORS, rate-limit, and sanitization defenses.

The remaining launch blockers are operational and hardening work rather than a full rewrite:

- Update vulnerable transitive packages and regenerate the lockfile.
- Verify the production database is reachable and fully migrated.
- Decide whether casual host-authoritative gameplay is acceptable, or move final competitive/reward-affecting state changes to server-authoritative validation.
- Run real browser QA against a healthy production-like DB, including desktop, mobile, reconnect, lobby, game, admin, store, and bug-report flows.
- Validate motion performance and reduced-motion behavior on low-end devices.

## Fixes Completed In This Pass

1. Auth failure no longer leaves the app stuck on the loading splash.
   - File: `index.tsx`
   - Change: `refreshSession()` now falls back to guest mode when Better Auth session lookup fails.
   - Why it matters: if the DB or auth route is temporarily unhealthy, guests should still reach the first usable screen instead of seeing an infinite loader.

2. Real-looking database credentials were scrubbed from the deployment guide.
   - File: `GUIDE.md`
   - Change: concrete `DATABASE_URL` examples were replaced with placeholders.
   - Required follow-up: if that credential was ever valid, rotate the database password before launch.

## Verification Run

| Check | Result | Notes |
| --- | --- | --- |
| TypeScript | Pass | `node node_modules/typescript/bin/tsc --noEmit` |
| Production build | Pass | `node node_modules/vite/bin/vite.js build` |
| Security smoke test | Pass | `node node_modules/tsx/dist/cli.mjs scripts/security-smoke-test.ts` |
| Dependency advisory scan | Fail | npm registry bulk advisory API returned 17 advisories: 7 high, 9 moderate, 1 low |
| Local server boot | Partial | Server listens on port 3107, but the local DB behind this environment returned unhealthy |
| Browser first-screen smoke | Partial | Browser reached the app title with no console errors, but local DB/auth health prevented full production-like visual QA |

Note: the shell did not expose `npm`, so `npm audit` could not be run directly here. I used the npm registry advisory API against `package-lock.json`; still run `npm audit --audit-level=moderate` in CI or a normal Node environment before launch.

## Vulnerability Findings

### P0: Scrubbed credential requires rotation decision

`GUIDE.md` contained a real-looking Postgres connection string. It is now replaced with placeholders, but launch should assume the old value is compromised if it ever pointed to a real database.

Required:

- Rotate the DB password if the old example was ever valid.
- Re-deploy with the rotated `DATABASE_URL`.
- Confirm `.env` and `.env.*` remain ignored.
- Search the remote repo and deployment docs for any remaining concrete secrets.

### P1: Lockfile contains active advisories

The current lockfile resolves vulnerable versions:

| Package | Current | Severity | Likely source |
| --- | ---: | --- | --- |
| `protobufjs` | `7.5.5` | High/moderate | `@google/genai` |
| `@protobufjs/utf8` | `1.1.0` | Moderate | `protobufjs` |
| `fast-uri` | `3.1.0` | High | `ajv` |
| `hono` | `4.12.15` | Moderate/low | `@hono/node-server`, `@modelcontextprotocol/sdk` |
| `kysely` | `0.28.16` | High | `better-auth`, `drizzle-orm` optional/peer paths |
| `ip-address` | `10.1.0` | Moderate | `express-rate-limit` |

Required:

- Refresh packages with a normal npm install/update environment.
- Prefer patched direct dependency updates first: `@google/genai`, `better-auth`, `drizzle-orm`, `express-rate-limit`, `vite`, `shadcn`, and any package pulling `@modelcontextprotocol/sdk`.
- Re-run `npm audit --audit-level=moderate`.
- Re-run typecheck, production build, smoke test, auth login, store purchase, and admin dashboard after the lockfile changes.

### P1: Admin ad inputs need URL scheme validation

Ad image/link/html fields are admin-only, but the public client renders them. `AdSlot` sandboxes HTML snippets, which is good, but `linkUrl`, `imageUrl`, and `htmlSnippet` should still be treated as high-risk content before third-party ads are allowed.

Required:

- Allow only `https://` URLs for ad links and images.
- Consider disallowing `htmlSnippet` entirely for launch, or keeping it for trusted internal ads only.
- Remove `allow-popups-to-escape-sandbox` unless there is a hard business requirement.

### P1: Host-authoritative game state is acceptable for casual rooms, not competitive rewards

The server validates action type, payload size/depth, actor identity, turn ownership, and chat/name inputs. That is good. But the room host still computes and syncs the full game state to other clients. A malicious host can cheat within their own room.

Required:

- For casual friend rooms: document this as acceptable trust model.
- For ranked play, public economy, coins, or rewards: move reducer execution and final result recording to the server.
- Keep `/api/profile/stats` and `/api/profile/win-coin` disabled until server-side match result recording is implemented.

### P2: Motion and canvas effects need production-device testing

The CSS respects `prefers-reduced-motion`, but the particle canvas and Three.js dice loops still run their own `requestAnimationFrame` loops. This can hurt low-end mobile battery/performance and may ignore reduced-motion users.

Required:

- Pause or reduce particle/dice animation when `prefers-reduced-motion: reduce`.
- Cap canvas DPR on mobile.
- Test 4-player board, dice rolling, set-complete animation, confetti, and mobile lobby on a low-end phone.

### P2: DB migration health must be checked on production-like data

The local server booted, but DB reads for admin board and app settings failed in this environment. That likely means the test environment DB is missing migrations or unreachable.

Required:

- Run `npm run db:push` or the migration workflow against staging.
- Verify `/api/health` returns `{"status":"ok","db":"ok"}`.
- Verify admin board, visual settings, auth, store, purchases, bug reports, ads, friends, and profile tables.

## Existing Strengths

- Server disables `x-powered-by` and sets CSP, `X-Frame-Options`, `nosniff`, HSTS in production, referrer policy, and permissions policy.
- Socket handshakes can be origin-restricted through `ALLOWED_ORIGINS`.
- Socket payloads are size/depth guarded and prototype-pollution keys are rejected.
- Player action allowlist is shared between server and client.
- Chat input is length-limited, sanitized for control/bidi characters, flood-limited, and server-attributed.
- Room IDs and player IDs use cryptographic randomness.
- Store purchase uses a DB transaction and atomic coin deduction.
- Client-submitted profile stats and win rewards are disabled.
- Visual defaults are centralized through `services/visualSettings.ts` and normalized before use.

## Final Checks For The Next Few Weeks

### Week 1: Security and dependency closure

- Rotate any credential that appeared in docs or screenshots.
- Update vulnerable packages and regenerate `package-lock.json`.
- Run `npm audit --audit-level=moderate` and save the clean output.
- Add CI checks for typecheck, build, smoke test, and audit.
- Lock `ALLOWED_ORIGINS` to production origins only.

### Week 2: Production-like QA

- Deploy staging with production env, HTTPS, and the real DB migration set.
- Browser-test desktop and mobile first screen, create room, join room, private room, reconnect, spectator join, leave room, and host promotion.
- Test game logic paths: jail, doubles, rent, bankruptcy, auction, trade accept/decline/cancel, mortgage/unmortgage, upgrades/downgrades, win state.
- Test authenticated flows: login, profile, settings, store inventory, purchase/equip, friends.
- Test admin flows: login, boards, visual settings, users, bug reports, ads, DB health.

### Week 3: Load, abuse, and polish

- Run multi-client socket tests for reconnects and host disconnects.
- Test chat/action spam and room creation/join rate limits.
- Record mobile performance for particle canvas, dice, and set-complete animation.
- Verify accessibility basics: keyboard focus, modal close/focus return, reduced motion, color contrast, and text overflow.
- Confirm deployment headers match `public/_headers` and Express production headers.

### Launch Gate

Launch only after all of these are true:

- `npm audit --audit-level=moderate` is clean or accepted with documented mitigations.
- Typecheck, build, smoke test, and staging health pass.
- Staging DB has all required tables and migrations.
- Browser QA passes on desktop and mobile.
- Credential rotation is complete if the old doc credential was ever real.
- The host-authoritative trust model is explicitly accepted, or server-authoritative validation is implemented for rewards/ranked state.

