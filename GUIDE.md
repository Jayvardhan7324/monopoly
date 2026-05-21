# Cashly — Production Setup Guide (Dokploy)

End-to-end guide to deploy Cashly on Dokploy. Read top-to-bottom — each section depends on the previous.

---

## 0. Critical fixes to your current env

Your Dokploy env as pasted has **three blockers** that will prevent the app from starting. Fix these first.

### 🔴 Fix 1 — `@` in your DB password must be URL-encoded

Your current value:
```
DATABASE_URL=postgresql://<user>:<raw-password>@<internal-db-host>:5432/<database>
```

Postgres URL parsers see an unencoded `@` inside the password as the username/host separator. That's why the app can't reach the database — and that causes the 502 you're seeing (Express never finishes booting, so Traefik has no upstream → 502 + missing favicon).

Change `@` → `%40`:
```
DATABASE_URL=postgresql://<user>:<url-encoded-password>@<internal-db-host>:5432/<database>
```

Even better — rotate the password to one without special characters (`@`, `:`, `/`, `?`, `#`, `%`, space). In Dokploy open the Postgres service → Advanced → change password to a new strong value and then update `DATABASE_URL`.

### 🔴 Fix 2 — Generate a real `BETTER_AUTH_SECRET`

Your current value `<paste a random 32-byte secret>` is literally a placeholder — the app will boot but **every session cookie will be invalid after a restart** (and right now it isn't a valid secret at all).

Generate one. Any of these work:
```bash
openssl rand -base64 32
npx @better-auth/cli@latest secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output as `BETTER_AUTH_SECRET`. Keep it **secret** — rotating it signs everyone out.

### 🔴 Fix 3 — `BETTER_AUTH_URL` must be your public domain

`http://localhost:3000` only works for local dev. In production Better Auth uses this for the OAuth callback and for cookie domain inference. Set it to whatever domain you attached in Dokploy → App → Domains:

```
BETTER_AUTH_URL=https://cashly.yourdomain.com
ALLOWED_ORIGINS=https://cashly.yourdomain.com
```

No trailing slash. If you also hit the app via `http://<server-ip>:3000` during testing, add that origin to `ALLOWED_ORIGINS` (comma-separated) temporarily.

---

## 1. About the "Better Auth panel"

**There is no separate Better Auth admin panel to log into.** Better Auth is a *library*, not a hosted service like Supabase or Clerk — it runs inside your own Express server at `/api/auth/*`. There's nothing to sign into on betterauth.com.

What you actually get:

| You want to… | Where you do it |
|---|---|
| Manage users (ban, change role, view coins) | `https://your-domain/__sys` — the **app's own admin dashboard** (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) |
| Inspect raw tables / run SQL | Dokploy → `monopoly-cashlydb-tvgpgl` → **Console** — opens a `psql` shell in the Postgres container |
| Check session / auth state | `GET /api/auth/get-session` with your session cookie |
| Rotate the auth secret | Change `BETTER_AUTH_SECRET` in Dokploy env + redeploy (signs everyone out) |

The `admin` plugin in `lib/auth.ts` is what powers your `/__sys` dashboard's user-management — it's already wired up. You don't need any additional Better Auth setup beyond the env vars above.

### Generating your first admin user

Better Auth has no "admin" concept until you promote someone. After you sign up normally through the login page, open the DB console in Dokploy and run:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

Then log into `https://your-domain/__sys` with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set in env. That's a **separate** dashboard-only gate — the DB role is what grants user-management API access via the admin plugin.

---

## 2. Full production-ready env

Paste this into Dokploy → `cashly-app` → **Environment**, filling the angle-bracketed values.

```env
# ── Database ────────────────────────────────────────────────────────────────
# Use the INTERNAL connection URL from the Postgres service.
# If your password contains @ : / ? # % or space, URL-encode it (@ → %40).
DATABASE_URL=postgresql://<user>:<url-encoded-password>@<internal-db-host>:5432/<database>

# ── Better Auth ─────────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=<32-byte base64 secret, NOT a placeholder>
# Exact public URL — must match the domain in Dokploy → Domains → HTTPS.
BETTER_AUTH_URL=https://cashly.yourdomain.com

# ── OAuth — Google (optional, recommended) ─────────────────────────────────
# Callback to register in Google Cloud: {BETTER_AUTH_URL}/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── OAuth — Apple (optional, paid Apple Developer) ─────────────────────────
# Callback: {BETTER_AUTH_URL}/api/auth/callback/apple
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
APPLE_APP_BUNDLE_ID=

# ── Admin dashboard (/__sys) ───────────────────────────────────────────────
# All three required — if any is missing, the admin panel is disabled.
ADMIN_TOKEN=<openssl rand -hex 32>
ADMIN_USERNAME=<pick, e.g. jay>
ADMIN_PASSWORD=<pick a strong one, 16+ chars>

# ── App ────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
# CORS + Better Auth trustedOrigins — comma-separated, no trailing slashes.
ALLOWED_ORIGINS=https://cashly.yourdomain.com

# ── AI (optional) ──────────────────────────────────────────────────────────
GEMINI_API_KEY=
```

Remove `NODE_VERSION=20` from the env — Nixpacks controls Node via `nixpacks.toml` already. Leaving a conflicting value there isn't fatal but is noise.

---

## 3. Deployment steps (first time)

1. **Postgres service** — already created (`monopoly-cashlydb-tvgpgl`). Good. Copy the internal URL.
2. **Application service** — Dokploy → Applications → Create → point at this Git repo → branch `main` → build type **Nixpacks** → port **3000**.
3. **Paste env** from section 2 above.
4. **Attach a domain** — Dokploy → App → Domains → add `cashly.yourdomain.com` → toggle HTTPS (Dokploy auto-provisions Let's Encrypt). DNS A record must already point at the Dokploy host.
5. **Deploy** — wait for green.
6. **Run the DB migration once** — App → Console → `npm run db:push`. Creates `user`, `session`, `account`, `verification`, and all app tables.
7. **Health check** — `curl https://cashly.yourdomain.com/api/health` → `{"status":"ok","db":"ok","schema":"ok"}`.
8. **Sign up normally** through the app's login page.
9. **Promote to admin** — Dokploy → Postgres service → Console:
   ```sql
   UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
   ```
10. **Verify** — log into `/__sys`, open Overview → **Run DB Test**. Green checks on connect/read/write/transaction.

---

## 4. Google OAuth (day-one feature)

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → **Create Credentials** → **OAuth client ID** → **Web application**.
2. **Authorized JavaScript origins**: `https://cashly.yourdomain.com`
3. **Authorized redirect URIs**: `https://cashly.yourdomain.com/api/auth/callback/google` (must match exactly — no trailing slash).
4. Paste client ID + secret into Dokploy env → redeploy.
5. The login page auto-shows the Google button once both env vars are non-empty (see `lib/auth.ts:38-45`).

---

## 5. Production hardening checklist

Tick these before calling it production-ready.

- [ ] `BETTER_AUTH_SECRET` is real (not placeholder), 32+ bytes, stored only in Dokploy env.
- [ ] `DATABASE_URL` password has no unencoded `@` `:` `/` `?` `#` `%` or spaces.
- [ ] Postgres service is **not** publicly exposed — internal hostname only. (Dokploy defaults are correct.)
- [ ] HTTPS is on for the domain and `BETTER_AUTH_URL` starts with `https://`.
- [ ] `ALLOWED_ORIGINS` lists only the production origin(s) — no `*`, no stale localhost.
- [ ] `ADMIN_TOKEN` is 32+ hex chars and different from `ADMIN_PASSWORD`.
- [ ] `ADMIN_USERNAME` is not `admin`, `root`, or your email.
- [ ] `NODE_ENV=production` (silences debug logs, enables Express optimizations).
- [ ] Dokploy → App → **Auto-deploy** off until you have a staging branch, or on with only `main` if you're comfortable.
- [ ] Schedule Dokploy → Postgres → **Backups** (daily, retention 7+ days).
- [ ] Rotate `ADMIN_PASSWORD` and `BETTER_AUTH_SECRET` every 90 days.
- [ ] The chrome-extension `Unexpected token 'export'` error in the screenshot is **not your app** — it's a browser extension injecting a bad script. Ignore.

---

## 6. Day-two operations

### Accessing the DB
Dokploy → `monopoly-cashlydb-tvgpgl` → **Console** → `psql` shell is already logged in.

Common queries:
```sql
-- how many users signed up today
SELECT count(*) FROM "user" WHERE "createdAt" > now() - interval '1 day';

-- active sessions
SELECT count(*) FROM "session" WHERE "expiresAt" > now();

-- promote/demote admin
UPDATE "user" SET role = 'admin' WHERE email = 'x@y.com';
UPDATE "user" SET role = 'user'  WHERE email = 'x@y.com';

-- ban a user
UPDATE "user" SET banned = true, "banReason" = 'spam', "banExpires" = now() + interval '30 days' WHERE email = 'bad@guy.com';
```

### Viewing logs
Dokploy → `cashly-app` → **Deployments** → click the running deployment → live log stream. `console.error`/`console.warn` always print; `console.log` is silenced in production (see `server.ts:38-39`).

### Rotating secrets
1. Generate new value (same commands as section 0).
2. Paste into Dokploy env.
3. Redeploy — old sessions are invalidated (users must sign in again). This is a feature, not a bug.

### Updating the schema
Edit `db/schema.ts` locally → commit + push → after Dokploy redeploys → App → Console → `npm run db:push`. Drizzle diffs and applies only what changed.

---

## 7. Troubleshooting

| Symptom | Root cause | Fix |
|---|---|---|
| 502 at the root URL + favicon 404 | App never booted. Almost always `DATABASE_URL` parse error or missing `BETTER_AUTH_SECRET`. | Check App → Logs for `[FATAL]`. Fix env → redeploy. |
| `[FATAL] Missing required env vars: DATABASE_URL` | Env var not set, or set but empty. | Paste the internal URL into Dokploy env → redeploy. |
| DB connects but `db:push` hangs | Password special chars not URL-encoded. | Encode `@` → `%40`, or rotate to a simpler password. |
| `/api/health` returns `schema:"missing"` | The app can connect to Postgres, but required tables are missing. | In the app console run `npm run db:push`, then re-check `/api/health`. |
| Google sign-in bounces back to login | `BETTER_AUTH_URL` ≠ the origin in Google Console's redirect URI. | Make them byte-identical including scheme + no trailing slash. |
| User signs in but is immediately signed out | `BETTER_AUTH_URL` is `http://` while browser is on `https://` → secure-cookie mismatch. | Set `BETTER_AUTH_URL=https://…`. |
| `/__sys` returns 401 even with correct creds | `ADMIN_TOKEN` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` not all three set. | Set all three → redeploy. |
| Sessions disappear on every deploy | `BETTER_AUTH_SECRET` is unset or changes between deploys. | Set it once in Dokploy env; don't regenerate on each deploy. |
| `chrome-extension://…content_reporter.js:1 Unexpected token 'export'` | A browser extension is injecting a module script into a non-module context. | Not your app. Ignore or disable the extension. |

---

## 8. Quick-start summary (TL;DR)

```bash
# 1. Generate secrets
openssl rand -base64 32           # → BETTER_AUTH_SECRET
openssl rand -hex 32              # → ADMIN_TOKEN

# 2. In Dokploy env, set (minimum):
DATABASE_URL=postgresql://<user>:<url-encoded-password>@<internal-db-host>:5432/<database>
BETTER_AUTH_SECRET=<secret from above>
BETTER_AUTH_URL=https://cashly.yourdomain.com
ALLOWED_ORIGINS=https://cashly.yourdomain.com
ADMIN_TOKEN=<hex from above>
ADMIN_USERNAME=jay
ADMIN_PASSWORD=<strong password>
NODE_ENV=production

# 3. Deploy, then in app console:
npm run db:push

# 4. Sign up via UI, then in Postgres console:
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';

# 5. Log in at https://cashly.yourdomain.com/__sys
```

Done. No "Better Auth panel" to chase — the admin UI lives inside your own app at `/__sys`.
