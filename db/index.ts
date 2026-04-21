import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Enable TLS to Postgres in production unless the connection string already specifies sslmode,
// or PGSSL=disable is set (internal dokploy network). `rejectUnauthorized: false` accepts
// self-signed certs common on managed providers; set PGSSL_STRICT=1 to enforce CA validation.
const url = process.env.DATABASE_URL || "";
const urlHasSslmode = /[?&]sslmode=/i.test(url);
const sslDisabled = process.env.PGSSL === "disable";
const isProd = process.env.NODE_ENV === "production";
const ssl = !sslDisabled && !urlHasSslmode && isProd
  ? { rejectUnauthorized: process.env.PGSSL_STRICT === "1" }
  : undefined;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(ssl ? { ssl } : {}),
});

export const db = drizzle(pool, { schema });
