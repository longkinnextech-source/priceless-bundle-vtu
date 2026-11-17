import { Pool, type PoolClient } from "pg";

const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";

const useSsl = connectionString.length > 0 && !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1");

declare global {
  // eslint-disable-next-line no-var
  var __pbPool: Pool | undefined;
}

function makePool(): Pool {
  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool(): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Set it in your environment.");
  }
  if (!global.__pbPool) global.__pbPool = makePool();
  return global.__pbPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs fn inside a transaction, committing on success and rolling back on any error. */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    client.release();
  }
}
