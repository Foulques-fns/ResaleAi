import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __resalePostgresqlPool?: Pool;
};

export const pool = databaseUrl
  ? (globalForDb.__resalePostgresqlPool ??
      new Pool({
        connectionString: databaseUrl,
      }))
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__resalePostgresqlPool = pool;
}

export const db = pool ? drizzle(pool) : null;
