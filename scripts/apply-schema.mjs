// Applies supabase/schema.sql to a Postgres database.
// Usage: DATABASE_URL="postgres://..." node scripts/apply-schema.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "postgres://postgres:postgres@localhost:5432/priceless";

const sql = readFileSync(join(__dirname, "..", "supabase", "schema.sql"), "utf8");

const client = new pg.Client({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log("✅ schema.sql applied successfully");
} catch (err) {
  console.error("❌ schema apply failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
