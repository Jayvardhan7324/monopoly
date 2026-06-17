# Deploying Cashly on Dokploy

This is the full end-to-end setup: one **Postgres database** service + one **Application** service. You do **not** need to split the frontend and backend — `server.ts` already serves the API and the built `dist/` from a single process.

## 0. Prereqs

- A Dokploy instance running on your Linux host (you already have this).
- A domain (or subdomain) pointed at the Dokploy host, e.g. `cashly.example.com`. You can also launch without TLS first and add the domain later — Better Auth will work on plain `http://host:port` during initial testing.
- Your GitHub repo connected in Dokploy → **Providers**.

---

## 1. Create the Postgres database

1. Dokploy UI → **Databases** → **Create Database** → select **Postgres**.
2. Fill in:
   - **Name**: `cashly-db`
   - **Database name**: `cashly`
   - **User**: `cashly`
   - **Password**: generate a strong one — save it.
   - **Image / Version**: `postgres:16` (or whatever Dokploy defaults to).
3. Click **Create**. Wait for the container to go green.
4. Open the database → **General** tab → copy the **Internal Connection URL**. It looks like:
   ```
   postgresql://cashly:<password>@cashly-db:5432/cashly
   ```
   This hostname (`cashly-db`) only resolves from **inside** the Dokploy Docker network — that's what your app will use. Do **not** use the external connection URL for the app; it is for your own `psql` / GUI client.

---

## 2. Create the application service

1. Dokploy UI → **Applications** → **Create Application**.
2. **Name**: `cashly-app`.
3. **Source**: GitHub → pick the `monopoly` repo → branch `main`.
4. **Build type**: **Nixpacks** (Dokploy auto-detects it because `nixpacks.toml` is in the repo root). No need to write a Dockerfile.
5. **Port**: `3000`.

### 2a. Environment variables

Open the app → **Environment** tab → paste these. Only `DATABASE_URL` and `BETTER_AUTH_SECRET` are strictly required; the OAuth and admin vars unlock features as you fill them in.

```env
# --- Database (use the INTERNAL connection URL from step 1) ---
DATABASE_URL=postgresql://cashly:<password>@cashly-db:5432/cashly

# --- Better Auth ---
# Generate with:  openssl rand -base64 32
BETTER_AUTH_SECRET=<paste random secret>
# The public URL your users will visit.
BETTER_AUTH_URL=https://cashly.example.com

# --- OAuth (optional, but you'll want Google on day one) ---
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>

APPLE_CLIENT_ID=<optional — requires paid Apple Developer account>
APPLE_CLIENT_SECRET=<optional>

# --- Admin panel ---
ADMIN_TOKEN=<openssl rand -hex 32>
ADMIN_USERNAME=<pick a username>
ADMIN_PASSWORD=<pick a strong password>

# --- App ---
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://cashly.example.com

# --- AI (optional) ---
GEMINI_API_KEY=
```

### 2b. Domain + TLS

App → **Domains** tab → **Add Domain** → `cashly.example.com` → toggle **HTTPS** (Dokploy provisions a Let's Encrypt cert automatically via Traefik). Make sure `BETTER_AUTH_URL` and `ALLOWED_ORIGINS` match exactly (including `https://`).

---

## 3. Create the DB schema

Dokploy doesn't know about Drizzle. You have two options:

### Option A — Run `db:push` once from the app shell (simplest)

1. Deploy the app first (step 4 below) so the container exists.
2. App → **Deployments** tab → click the running container → **Open Shell** (or **Console**).
3. Run:
   ```bash
   npm run db:push
   ```
   You'll see Drizzle create the `user`, `session`, `account`, `verification`, and all app-specific tables.

### Option B — Bake it into the build

Edit `nixpacks.toml` so `db:push` runs on every deploy. Only do this once schema stability is a concern — during initial setup, Option A is faster because you can see the output.

---

## 4. Deploy

App → **Deployments** → **Deploy**. Dokploy will:
- `git pull` the latest `main`
- detect Nixpacks, install deps, run `npm run build`
- start `npm start` (which is `tsx server.ts`)

Once it's green, hit `https://cashly.example.com/api/health` — you should see `{"status":"ok"}`.

---

## 5. Configure OAuth providers

### Google
1. https://console.cloud.google.com → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID** → **Web application**.
2. **Authorized JavaScript origins**: `https://cashly.example.com`
3. **Authorized redirect URIs**: `https://cashly.example.com/api/auth/callback/google`
4. Paste the Client ID and Client Secret into Dokploy env vars → redeploy.

### Apple (optional)
Requires a paid Apple Developer account. See Better Auth docs → Social Sign-On → Apple for how to generate the `APPLE_CLIENT_SECRET` JWT from your `.p8` key.

---

## 6. Verify everything

1. Visit `https://cashly.example.com`, click Sign In → try Google login and email+password signup.
2. Grant yourself admin:
   ```bash
   # From the DB shell (Dokploy → cashly-db → Console):
   UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
   ```
3. Navigate to `https://cashly.example.com/__sys` → log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
4. **Overview** tab → **Run DB Test**. You should see green checks for connect / read / write / transaction rollback, plus row counts for every table.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| App logs say `[FATAL] Missing required env vars: DATABASE_URL` | You used the external DB URL or misspelled the hostname. In-network it must be `cashly-db:5432`, not `localhost` or the external IP. |
| Google sign-in loops back to login | `BETTER_AUTH_URL` and the Google redirect URI don't match. They must be **exactly** identical (including `https://` and no trailing slash). |
| DB Test fails on `write: insert+delete bug_report` but connect succeeds | The DB user lacks write perms. Dokploy's managed Postgres grants full rights to the creating user — double-check you're using the right `DATABASE_URL`. |
| OAuth works locally but not in prod | You forgot to add the production callback URL to Google/Apple, or `ALLOWED_ORIGINS` doesn't include the prod origin. |
| Session cookie is missing / user signs in but immediately signed out | Running behind a reverse proxy without `app.set('trust proxy', 1)` (server.ts already does this) **or** `BETTER_AUTH_URL` is `http://` while the browser is on `https://`. |

---

## Local development against this setup

You don't need to install Postgres on Windows. Run it in Docker:

```bash
docker run --name cashly-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

Then set in `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
BETTER_AUTH_SECRET=<any dev-only random string>
BETTER_AUTH_URL=http://localhost:3000
```

Run `npm run db:push` once, then `npm run dev`.
