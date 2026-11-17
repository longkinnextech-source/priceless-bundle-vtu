// End-to-end verification of every Postgres function in supabase/schema.sql.
// Runs against a REAL Postgres database inside a transaction that is rolled back,
// so it is repeatable and never leaves test data behind.
//
// Usage: DATABASE_URL="postgres://..." node scripts/test-db.mjs
import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "postgres://postgres:postgres@localhost:5432/priceless";

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
});

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ❌ ${name} ${extra}`);
  }
}

const num = (v) => Number(v);
const close = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

async function expectError(label, sql, params, codeFragment) {
  await client.query("SAVEPOINT sp");
  try {
    await client.query(sql, params);
    await client.query("ROLLBACK TO SAVEPOINT sp");
    ok(`${label} — rejected`, false, "(expected an error, got none)");
  } catch (err) {
    await client.query("ROLLBACK TO SAVEPOINT sp");
    const msg = String(err.message || "");
    const good = codeFragment ? msg.includes(codeFragment) : true;
    ok(`${label} — rejected (${msg.split("\n")[0]})`, good, codeFragment ? `(expected "${codeFragment}")` : "");
  }
}

async function main() {
  await client.connect();

  // Clean slate for the tables we touch (test DB only), then re-seed plans.
  await client.query("BEGIN");
  await client.query("DELETE FROM bot_orders");
  await client.query("DELETE FROM wallet_ledger");
  await client.query("DELETE FROM withdrawals");
  await client.query("DELETE FROM deposits");
  await client.query("DELETE FROM deposit_intents");
  await client.query("DELETE FROM orders");
  await client.query("UPDATE users SET squad_id = NULL");
  await client.query("DELETE FROM squads");
  await client.query("DELETE FROM wallets");
  await client.query("DELETE FROM users");

  console.log("\n── 1. Users, wallets, tiers ────────────────────────────────");

  const S = (await client.query("select * from fn_register_user($1,$2,$3)", ["0240000001", "Super Sam", "super_agent"])).rows[0];
  const B = (await client.query("select * from fn_register_user($1,$2,$3)", ["0240000002", "Sub Sarah", "sub_agent"])).rows[0];
  const C = (await client.query("select * from fn_register_user($1,$2,$3)", ["0240000003", "Cust Kofi", "customer"])).rows[0];

  ok("three users registered", S.tier === "super_agent" && B.tier === "sub_agent" && C.tier === "customer");
  ok("wallet auto-created at 0", num((await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0].balance_ghs) === 0);

  const sq = (await client.query(
    "insert into squads (super_agent_id, name, volume_target_ghs) values ($1,'Fire Squad',500) returning *",
    [S.id]
  )).rows[0];
  await client.query("update users set squad_id=$1 where id=$2", [sq.id, B.id]);
  ok("squad created + sub-agent attached", num(sq.volume_target_ghs) === 500);

  const dup = (await client.query("select * from fn_register_user($1,$2,$3)", ["0240000003", "Cust Kofi", "customer"])).rows[0];
  const userCount = num((await client.query("select count(*) c from users where phone='0240000003'")).rows[0].c);
  ok("re-registering a phone reuses the row (no duplicate)", dup.id === C.id && userCount === 1);

  console.log("\n── 2. Wallet credit / debit / no negative balance ──────────");

  await client.query("select fn_wallet_credit($1,$2,'deposit',$3)", [C.id, 100, "seed"]);
  let bal = (await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0];
  ok("credit 100 → balance 100", num(bal.balance_ghs) === 100);

  const led = (await client.query("select * from wallet_ledger where user_id=$1 order by created_at desc limit 1", [C.id])).rows[0];
  ok("ledger row snapshots balance_after", num(led.balance_after) === 100 && led.type === "deposit");

  await expectError("debit 999 > balance", "select fn_wallet_debit($1,$2,'purchase',$3)", [C.id, 999, "x"], "INSUFFICIENT_BALANCE");
  bal = (await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0];
  ok("balance unchanged after failed debit", num(bal.balance_ghs) === 100);

  await expectError("credit negative amount", "select fn_wallet_credit($1,$2,'deposit',$3)", [C.id, -5, "x"], "AMOUNT_MUST_BE_POSITIVE");

  console.log("\n── 3. Tier pricing resolver ────────────────────────────────");

  const mtn1 = (await client.query(
    "select id, retail_price_ghs, sub_agent_price_ghs, super_agent_price_ghs from plans where network='mtn' and capacity_gb=1"
  )).rows[0];
  const pCust = num((await client.query("select fn_price_for_tier($1,'customer') p", [mtn1.id])).rows[0].p);
  const pSub = num((await client.query("select fn_price_for_tier($1,'sub_agent') p", [mtn1.id])).rows[0].p);
  const pSup = num((await client.query("select fn_price_for_tier($1,'super_agent') p", [mtn1.id])).rows[0].p);
  ok("tier prices resolve and are ordered customer ≥ sub ≥ super", pCust >= pSub && pSub >= pSup, `(${pCust}/${pSub}/${pSup})`);
  ok("customer price = retail 4.20", pCust === num(mtn1.retail_price_ghs));

  console.log("\n── 4. Buy data — atomic order + debit ──────────────────────");

  await client.query("update wallets set balance_ghs=0 where user_id=$1", [C.id]);
  await expectError(
    "purchase with 0 balance blocks entirely",
    "select fn_create_order_and_debit($1,$2,$3)", [C.id, mtn1.id, "0201111111"], "INSUFFICIENT_BALANCE"
  );
  const orderCount0 = num((await client.query("select count(*) c from orders where buyer_id=$1", [C.id])).rows[0].c);
  ok("no order row created when debit fails", orderCount0 === 0);

  await client.query("select fn_wallet_credit($1,$2,'deposit',$3)", [C.id, 50, "seed2"]);
  const o1 = (await client.query("select * from fn_create_order_and_debit($1,$2,$3)", [C.id, mtn1.id, "0201111111"])).rows[0];
  ok("order created as 'processing'", o1.status === "processing");
  ok("price charged = customer retail", num(o1.price_charged_ghs) === pCust);
  ok("buyer tier snapshot stored", o1.buyer_tier_at_purchase === "customer");
  bal = (await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0];
  ok("wallet debited atomically (50 - 4.20 = 45.80)", num(bal.balance_ghs) === 45.8);

  await expectError("purchase with invalid recipient phone", "select fn_create_order_and_debit($1,$2,$3)", [C.id, mtn1.id, "12345"], "INVALID_RECIPIENT_PHONE");

  console.log("\n── 5. Order finalize: success → commission + squad volume ──");

  const f1 = (await client.query("select * from fn_finalize_order($1,$2,$3,$4)", [o1.id, true, "DMGH-REF-001", null])).rows[0];
  ok("order marked delivered", f1.status === "delivered");
  ok("supplier_reference stored", f1.supplier_reference === "DMGH-REF-001");

  const sCommNoSquad = num((await client.query("select commission_balance_ghs from wallets where user_id=$1", [S.id])).rows[0].commission_balance_ghs);
  ok("no commission when buyer is not in any squad (correct)", sCommNoSquad === 0);

  const sqAfter = (await client.query("select * from squads where id=$1", [sq.id])).rows[0];
  ok("squad volume did not move for a non-squad buyer", num(sqAfter.current_volume_ghs) === 0);

  await client.query("select * from fn_finalize_order($1,$2,$3,$4)", [o1.id, true, "DMGH-REF-001", null]);
  const balIdem = num((await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0].balance_ghs);
  ok("finalize is idempotent (balance unchanged on re-finalize)", balIdem === 45.8, `(got ${balIdem})`);

  console.log("\n── 6. Order finalize: failure → auto refund ────────────────");

  await client.query("select fn_wallet_credit($1,$2,'deposit',$3)", [B.id, 30, "seedB"]);
  const o2 = (await client.query("select * from fn_create_order_and_debit($1,$2,$3)", [B.id, mtn1.id, "0202222222"])).rows[0];
  const bAfterBuy = num((await client.query("select balance_ghs from wallets where user_id=$1", [B.id])).rows[0].balance_ghs);
  ok("sub-agent charged sub-agent price", num(o2.price_charged_ghs) === pSub, `(got ${o2.price_charged_ghs})`);

  const f2 = (await client.query("select * from fn_finalize_order($1,$2,$3,$4)", [o2.id, false, null, "Insufficient wallet balance"])).rows[0];
  ok("order marked refunded", f2.status === "refunded");
  ok("failure reason surfaced", f2.failure_reason === "Insufficient wallet balance");
  const bAfterRefund = num((await client.query("select balance_ghs from wallets where user_id=$1", [B.id])).rows[0].balance_ghs);
  ok("buyer refunded in full", bAfterRefund === bAfterBuy + num(o2.price_charged_ghs), `(${bAfterBuy} → ${bAfterRefund})`);
  const refundLed = (await client.query("select * from wallet_ledger where user_id=$1 and type='refund'", [B.id])).rows[0];
  ok("refund written to ledger", refundLed && num(refundLed.amount_ghs) === num(o2.price_charged_ghs));

  console.log("\n── 7. Squad volume recompute ───────────────────────────────");

  const o3 = (await client.query("select * from fn_create_order_and_debit($1,$2,$3)", [B.id, mtn1.id, "0203333333"])).rows[0];
  await client.query("select fn_finalize_order($1,$2,$3,$4)", [o3.id, true, "DMGH-REF-003", null]);
  const sqV = (await client.query("select * from squads where id=$1", [sq.id])).rows[0];
  ok("squad volume = delivered order by squad member", num(sqV.current_volume_ghs) === num(o3.price_charged_ghs), `(got ${sqV.current_volume_ghs})`);
  ok("tier not retained below target", sqV.tier_retained === false);

  const sComm = num((await client.query("select commission_balance_ghs from wallets where user_id=$1", [S.id])).rows[0].commission_balance_ghs);
  const expectedComm = Math.round(num(o3.price_charged_ghs) * 3) / 100;
  ok(`super agent commission credited on squad-member sale (3% = ${expectedComm})`, close(sComm, expectedComm), `(got ${sComm})`);

  await client.query("update squads set volume_target_ghs=1 where id=$1", [sq.id]);
  await client.query("select fn_recompute_squad_volume($1)", [sq.id]);
  const sqV2 = (await client.query("select * from squads where id=$1", [sq.id])).rows[0];
  ok("tier retained once target hit", sqV2.tier_retained === true);

  console.log("\n── 8. Deposits: intent + atomic credit ─────────────────────");

  const intent = (await client.query(
    "insert into deposit_intents (user_id, reference_code, expected_amount_ghs) values ($1,$2,$3) returning *",
    [C.id, "PB-4X7Q", 20]
  )).rows[0];
  ok("intent created with reference code", intent.reference_code === "PB-4X7Q");

  const dep = (await client.query(
    "insert into deposits (amount_ghs, reference_code, sender_phone, raw_sms, status) values ($1,$2,$3,$4,$5) returning *",
    [20, "PB-4X7Q", "0240000003", "Payment received 20.00 from 0240000003 ref PB-4X7Q", "matched"]
  )).rows[0];
  await client.query("update deposits set matched_intent_id=$1 where id=$2", [intent.id, dep.id]);
  const balBefore = num((await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0].balance_ghs);

  const credited = (await client.query("select * from fn_credit_deposit($1,$2)", [dep.id, C.id])).rows[0];
  const balAfter = num((await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0].balance_ghs);
  ok("deposit credited", credited.status === "credited");
  ok("wallet increased by deposit amount", balAfter === balBefore + 20);
  const intentAfter = (await client.query("select * from deposit_intents where id=$1", [intent.id])).rows[0];
  ok("intent marked credited", intentAfter.status === "credited");

  await client.query("select * from fn_credit_deposit($1,$2)", [dep.id, C.id]);
  const balAfter2 = num((await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0].balance_ghs);
  ok("deposit credit is idempotent", balAfter2 === balAfter);

  console.log("\n── 9. P2P transfer ─────────────────────────────────────────");

  const cB = num((await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0].balance_ghs);
  const bB = num((await client.query("select balance_ghs from wallets where user_id=$1", [B.id])).rows[0].balance_ghs);
  await client.query("select fn_p2p_transfer($1,$2,$3)", [C.id, B.id, 10]);
  const cA = num((await client.query("select balance_ghs from wallets where user_id=$1", [C.id])).rows[0].balance_ghs);
  const bA = num((await client.query("select balance_ghs from wallets where user_id=$1", [B.id])).rows[0].balance_ghs);
  ok("sender debited", cA === cB - 10);
  ok("receiver credited", bA === bB + 10);
  await expectError("p2p to self", "select fn_p2p_transfer($1,$2,$3)", [C.id, C.id, 5], "CANNOT_SEND_TO_SELF");

  console.log("\n── 10. Commission reinvest bonus ───────────────────────────");

  await client.query("select fn_wallet_credit($1,$2,'commission',$3,'{}'::jsonb,'commission')", [B.id, 40, "seedcomm"]);
  const mainBefore = num((await client.query("select balance_ghs from wallets where user_id=$1", [B.id])).rows[0].balance_ghs);
  const commBefore = num((await client.query("select commission_balance_ghs from wallets where user_id=$1", [B.id])).rows[0].commission_balance_ghs);
  const bonus = num((await client.query("select fn_reinvest_commission($1,$2) b", [B.id, 20])).rows[0].b);
  const mainAfter = num((await client.query("select balance_ghs from wallets where user_id=$1", [B.id])).rows[0].balance_ghs);
  const commAfter = num((await client.query("select commission_balance_ghs from wallets where user_id=$1", [B.id])).rows[0].commission_balance_ghs);
  ok("sub-agent reinvest bonus = 3.5% of 20 = 0.70", close(bonus, 0.7), `(got ${bonus})`);
  ok("commission bucket reduced by amount", close(commAfter, commBefore - 20));
  ok("main wallet increased by amount + bonus", close(mainAfter, mainBefore + 20 + 0.7), `(${mainBefore} → ${mainAfter}, expected ${mainBefore + 20.7})`);

  console.log("\n── 11. Withdrawals & fees ──────────────────────────────────");

  await client.query("update wallets set balance_ghs=200 where user_id=$1", [B.id]);
  const w1 = (await client.query("select * from fn_request_withdrawal($1,$2,$3)", [B.id, 100, "instant"])).rows[0];
  ok("sub-agent instant withdrawal charges fee (1.5% = 1.50)", num(w1.fee_ghs) === 1.5, `(got ${w1.fee_ghs})`);
  ok("net = amount - fee", num(w1.net_ghs) === 98.5);
  const bW = num((await client.query("select balance_ghs from wallets where user_id=$1", [B.id])).rows[0].balance_ghs);
  ok("wallet debited amount total (net+fee)", bW === 100);

  const w2 = (await client.query("select * from fn_request_withdrawal($1,$2,$3)", [B.id, 50, "free_friday_batch"])).rows[0];
  ok("free friday batch has zero fee", num(w2.fee_ghs) === 0 && num(w2.net_ghs) === 50);

  await expectError("withdrawal below minimum", "select fn_request_withdrawal($1,$2,$3)", [B.id, 1, "instant"], "BELOW_MIN_WITHDRAWAL");

  console.log("\n── 12. Super Agent upgrade gate ────────────────────────────");

  await expectError("upgrade without 500 commitment", "select fn_upgrade_to_super_agent($1)", [C.id], "COMMITMENT_NOT_MET");
  await client.query("update wallets set balance_ghs=600 where user_id=$1", [C.id]);
  const up = (await client.query("select * from fn_upgrade_to_super_agent($1)", [C.id])).rows[0];
  ok("upgrade succeeds once committed", up.tier === "super_agent");

  const wSup = (await client.query("select * from fn_request_withdrawal($1,$2,$3)", [C.id, 100, "instant"])).rows[0];
  ok("super agent instant withdrawal is fee-free", num(wSup.fee_ghs) === 0);

  console.log("\n── 13. Ledger immutability ─────────────────────────────────");

  await expectError("ledger UPDATE blocked", "update wallet_ledger set amount_ghs=0 where user_id=$1", [C.id], "append-only");
  await expectError("ledger DELETE blocked", "delete from wallet_ledger where user_id=$1", [C.id], "append-only");

  console.log("\n── 14. Bot orders ──────────────────────────────────────────");

  const bo = (await client.query(
    "insert into bot_orders (order_id, super_agent_id, channel, end_customer_phone) values ($1,$2,$3,$4) returning *",
    [o1.id, S.id, "telegram", "0209999999"]
  )).rows[0];
  ok("bot order linked to order + super agent", bo.channel === "telegram");

  await client.query("ROLLBACK");
  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) console.log("  Failed: " + failures.join(", "));
  console.log("════════════════════════════════════════════════════════════\n");

  await client.end();
  process.exitCode = fail ? 1 : 0;
}

main().catch(async (e) => {
  console.error("FATAL:", e.message);
  try { await client.query("ROLLBACK"); } catch {}
  try { await client.end(); } catch {}
  process.exitCode = 1;
});
