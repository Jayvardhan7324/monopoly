import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// TLS is opt-in: Dokploy's internal network does not offer SSL, and node-postgres
// errors out with "server does not support SSL" if we try. Enable only when the
// URL sets sslmode=require/verify-*, or PGSSL=require is set explicitly.
// Set PGSSL_STRICT=1 to enforce CA validation; otherwise self-signed certs are accepted.
const url = process.env.DATABASE_URL || "";
const urlWantsSsl = /[?&]sslmode=(require|verify-ca|verify-full)/i.test(url);
const envWantsSsl = process.env.PGSSL === "require";
const ssl = (urlWantsSsl || envWantsSsl)
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
