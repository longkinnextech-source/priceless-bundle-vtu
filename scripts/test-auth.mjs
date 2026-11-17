// Verifies the phone+PIN auth functions against a real Postgres database.
import pg from "pg";
const url = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/priceless";
const c = new pg.Client({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
let pass = 0, fail = 0;
const ok = (n, cond, extra = "") => { cond ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, console.log(`  ❌ ${n} ${extra}`)); };

await c.connect();
await c.query("BEGIN");
await c.query("DELETE FROM wallet_ledger");
await c.query("DELETE FROM wallets");
await c.query("DELETE FROM users");

const u = (await c.query("select * from fn_register_user_with_pin('0245550001','Ama','1234','sub_agent')")).rows[0];
ok("register with PIN sets hash + tier", !!u.pin_hash && u.tier === "sub_agent");

const l = (await c.query("select * from fn_login('0245550001','1234')")).rows[0];
ok("login with correct PIN succeeds", l && l.phone === '0245550001');

async function rejected(label, sql) {
  await c.query("SAVEPOINT s");
  try { await c.query(sql); await c.query("ROLLBACK TO SAVEPOINT s"); ok(label, false, "(no error)"); }
  catch (e) { await c.query("ROLLBACK TO SAVEPOINT s"); ok(label, true); }
}
await rejected("wrong PIN rejected", "select * from fn_login('0245550001','9999')");
await rejected("unknown phone rejected", "select * from fn_login('0240000000','1234')");
await rejected("duplicate registration rejected", "select * from fn_register_user_with_pin('0245550001','Ama','5678','customer')");
await rejected("self-declared super_agent rejected", "select * from fn_register_user_with_pin('0245550002','X','1234','super_agent')");
await rejected("short PIN rejected", "select * from fn_register_user_with_pin('0245550003','Y','12','customer')");

await c.query("select fn_make_admin('0245550001')");
const a = (await c.query("select is_admin from users where phone='0245550001'")).rows[0];
ok("fn_make_admin grants admin flag", a.is_admin === true);

await c.query("ROLLBACK");
console.log(`\n  auth: ${pass} passed, ${fail} failed\n`);
await c.end();
process.exitCode = fail ? 1 : 0;
