// End-to-end HTTP test against the RUNNING Next.js server + real Postgres.
// Exercises the wallet top-up flow and the buy-data flow exactly as a browser would.
//
// Usage: BASE_URL=http://localhost:3000 node scripts/test-e2e.mjs
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.SMS_WEBHOOK_SECRET || "test-secret";

let pass = 0, fail = 0;
const failures = [];
const ok = (n, c, x = "") => c ? (pass++, console.log(`  ✅ ${n}`)) : (fail++, failures.push(n), console.log(`  ❌ ${n} ${x}`));

function jar() {
  const store = new Map();
  return {
    header: () => [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb: (res) => {
      const raw = res.headers.getSetCookie?.() ?? [];
      for (const c of raw) {
        const [pair] = c.split(";");
        const idx = pair.indexOf("=");
        store.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    },
  };
}

async function call(path, opts = {}, j) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(j ? { cookie: j.header() } : {}), ...(opts.headers || {}) },
    redirect: "manual",
  });
  if (j) j.absorb(res);
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { res, json };
}

const uniq = () => "0" + String(Math.floor(200000000 + Math.random() * 700000000)).slice(0, 9);

async function main() {
  console.log(`\nTesting ${BASE}\n`);

  // ---------- health ----------
  const home = await fetch(BASE + "/");
  ok("landing page responds 200", home.status === 200, `(got ${home.status})`);
  const html = await home.text();
  ok("landing renders brand name", html.includes("Priceless"));
  ok("logo.png referenced in document", html.includes("/logo.png"));

  // ---------- AUTH ----------
  const cust = jar();
  const custPhone = uniq();
  const reg = await call("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ phone: custPhone, name: "E2E Customer", pin: "4321", tier: "customer" }),
  }, cust);
  ok("register customer", reg.res.status === 200 && reg.json?.ok === true, JSON.stringify(reg.json?.error));
  ok("session cookie set", cust.header().includes("pb_session"));

  const login2 = await call("/api/auth/login", {
    method: "POST", body: JSON.stringify({ phone: custPhone, pin: "4321" }),
  }, jar());
  ok("login with correct PIN", login2.json?.ok === true);
  const badLogin = await call("/api/auth/login", {
    method: "POST", body: JSON.stringify({ phone: custPhone, pin: "0000" }),
  }, jar());
  ok("login with wrong PIN rejected", badLogin.res.status === 401);

  const me = await call("/api/auth/me", {}, cust);
  ok("me returns the session user", me.json?.data?.user?.phone === custPhone);

  // ---------- PLANS ----------
  const plans = await call("/api/plans", {}, cust);
  const planList = plans.json?.data?.plans ?? [];
  ok("plans load (33 seeded)", planList.length === 33, `(got ${planList.length})`);
  ok("customer sees retail tier", plans.json?.data?.tier === "customer");
  const mtn1 = planList.find((p) => p.network === "mtn" && p.capacity_gb === 1);
  ok("MTN 1GB present at 4.20", mtn1 && Number(mtn1.price_ghs) === 4.2, mtn1 && String(mtn1.price_ghs));

  // ---------- BUY BLOCKED AT ZERO BALANCE ----------
  const failBuy = await call("/api/orders", {
    method: "POST", body: JSON.stringify({ plan_id: mtn1.id, recipient_phone: "0241111111" }),
  }, cust);
  ok("purchase with 0 balance blocked", failBuy.res.status === 400 && failBuy.json?.error?.code === "INSUFFICIENT_BALANCE",
    JSON.stringify(failBuy.json?.error));

  // ---------- MTN VERIFY ----------
  const vfy = await call("/api/verify-number", { method: "POST", body: JSON.stringify({ phone: "0241111111" }) }, cust);
  ok("MTN verify endpoint responds", vfy.res.status === 200 && typeof vfy.json?.data?.servable === "boolean",
    JSON.stringify(vfy.json));

  // ---------- WALLET TOP-UP FLOW ----------
  const intent = await call("/api/deposits/intent", { method: "POST", body: JSON.stringify({ amount: 50 }) }, cust);
  ok("top-up intent created", intent.res.status === 200 && intent.json?.ok === true, JSON.stringify(intent.json?.error));
  const code = intent.json?.data?.intent?.reference_code;
  ok("reference code formatted PB-XXXX", /^PB-[A-Z0-9]{4,6}$/.test(String(code)), code);
  ok("collection number returned", !!intent.json?.data?.collection_number);

  const balBefore = Number((await call("/api/wallet", {}, cust)).json?.data?.wallet?.balance_ghs ?? 0);
  ok("wallet starts at 0", balBefore === 0, String(balBefore));

  // webhook: wrong secret must be rejected
  const badHook = await fetch(BASE + "/api/webhook/sms-deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": "wrong" },
    body: JSON.stringify({ text: "Payment received GHS50.00 from 0241111111 ref " + code }),
  });
  ok("webhook rejects wrong secret", badHook.status === 403);

  // webhook: real MTN-style SMS, correct secret
  const sms = `You have received GHS50.00 from KOFI MENSAH 0241111111. Reference: ${code}. Your new balance is GHS1,234.56.`;
  const hook = await fetch(BASE + "/api/webhook/sms-deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": SECRET },
    body: JSON.stringify({ text: sms }),
  });
  const hookJson = await hook.json();
  ok("webhook accepts + credits deposit", hook.status === 200 && hookJson?.data?.status === "credited",
    JSON.stringify(hookJson));
  ok("webhook reports matched=true", hookJson?.data?.matched === true);

  const balAfter = Number((await call("/api/wallet", {}, cust)).json?.data?.wallet?.balance_ghs ?? 0);
  ok("wallet credited by 50.00", balAfter === 50, `(${balBefore} → ${balAfter})`);

  const wallet = await call("/api/wallet", {}, cust);
  const ledger = wallet.json?.data?.ledger ?? [];
  ok("ledger has the deposit entry", ledger.some((l) => l.type === "deposit" && Number(l.amount_ghs) === 50));
  ok("ledger snapshot balance_after=50", ledger.some((l) => Number(l.balance_after) === 50));

  // ---------- BUY DATA FLOW ----------
  const buy = await call("/api/orders", {
    method: "POST", body: JSON.stringify({ plan_id: mtn1.id, recipient_phone: "0241111111" }),
  }, cust);
  ok("purchase succeeds once funded", buy.res.status === 200 && buy.json?.ok === true, JSON.stringify(buy.json?.error));
  const order = buy.json?.data?.order;
  ok("order finalised (delivered or refunded)", ["delivered", "refunded"].includes(order?.status), order?.status);
  ok(
    "supplier reference stored on delivered orders",
    order?.status !== "delivered" || !!order?.supplier_reference,
    order?.status
  );

  const balEnd = Number((await call("/api/wallet", {}, cust)).json?.data?.wallet?.balance_ghs ?? 0);
  const expected = order?.status === "delivered" ? 50 - 4.2 : 50;
  ok(`wallet reflects outcome (expected ${expected})`, Math.abs(balEnd - expected) < 0.005, String(balEnd));

  const orders = await call("/api/orders", {}, cust);
  ok("order appears in history", (orders.json?.data?.orders ?? []).length >= 1);

  // ---------- P2P ----------
  const cust2 = jar();
  const cust2Phone = uniq();
  await call("/api/auth/register", {
    method: "POST", body: JSON.stringify({ phone: cust2Phone, name: "E2E Second", pin: "4321" }),
  }, cust2);
  const p2p = await call("/api/wallet/p2p", {
    method: "POST", body: JSON.stringify({ recipient_phone: cust2Phone, amount: 5 }),
  }, cust);
  const p2pOk = p2p.json?.ok === true;
  if (expected >= 5) {
    ok("p2p transfer succeeds", p2pOk, JSON.stringify(p2p.json?.error));
    const b2 = Number((await call("/api/wallet", {}, cust2)).json?.data?.wallet?.balance_ghs ?? 0);
    ok("recipient received 5.00", b2 === 5, String(b2));
  } else {
    ok("p2p transfer correctly rejected for insufficient funds", p2p.json?.error?.code === "INSUFFICIENT_BALANCE");
  }

  // ---------- WITHDRAWALS ----------
  const wd = await call("/api/withdrawals", {
    method: "POST", body: JSON.stringify({ amount: 10, mode: "instant" }),
  }, cust2);
  ok("withdrawal rejected when balance short", wd.res.status === 400, JSON.stringify(wd.json?.error));

  // ---------- SUB-AGENT PRICING ----------
  const agent = jar();
  const agentPhone = uniq();
  await call("/api/auth/register", {
    method: "POST", body: JSON.stringify({ phone: agentPhone, name: "E2E Agent", pin: "4321", tier: "sub_agent" }),
  }, agent);
  const agentPlans = await call("/api/plans", {}, agent);
  const agentMtn1 = (agentPlans.json?.data?.plans ?? []).find((p) => p.network === "mtn" && p.capacity_gb === 1);
  ok("sub-agent sees agent price (3.90)", agentMtn1 && Number(agentMtn1.price_ghs) === 3.9,
    agentMtn1 && String(agentMtn1.price_ghs));

  // server must NOT trust a client-sent price
  await call("/api/deposits/intent", { method: "POST", body: JSON.stringify({ amount: 20 }) }, agent);
  const agentIntent = (await call("/api/wallet", {}, agent)).json?.data?.pending_intents?.[0];
  await fetch(BASE + "/api/webhook/sms-deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": SECRET },
    body: JSON.stringify({ text: `GHS20.00 received from 0249999999 Ref ${agentIntent.reference_code}` }),
  });
  const tampered = await call("/api/orders", {
    method: "POST",
    body: JSON.stringify({ plan_id: mtn1.id, recipient_phone: "0242222222", price_ghs: 0.01, price_charged_ghs: 0.01 }),
  }, agent);
  const tOrder = tampered.json?.data?.order;
  ok("client-sent price is ignored (charged agent price, not 0.01)",
    tOrder && Math.abs(Number(tOrder.price_charged_ghs) - 3.9) < 0.005, tOrder && String(tOrder.price_charged_ghs));

  // ---------- ADMIN PIN GATE ----------
  const adminJar = jar();
  const noPin = await call("/api/admin/stats", {}, adminJar);
  ok("admin API locked without PIN", noPin.res.status === 401);
  const wrongPin = await call("/api/admin/login", { method: "POST", body: JSON.stringify({ pin: "9999" }) }, adminJar);
  ok("wrong admin PIN rejected", wrongPin.res.status === 401);
  const goodPin = await call("/api/admin/login", { method: "POST", body: JSON.stringify({ pin: process.env.ADMIN_PIN || "2468" }) }, adminJar);
  ok("correct admin PIN unlocks", goodPin.json?.ok === true, JSON.stringify(goodPin.json?.error));
  const stats = await call("/api/admin/stats", {}, adminJar);
  ok("admin stats readable after unlock", stats.json?.ok === true && Number(stats.json?.data?.stats?.total_users) >= 3);

  // admin price edit round-trip
  const adminPlans = await call("/api/admin/plans", {}, adminJar);
  const target = (adminPlans.json?.data?.plans ?? []).find((p) => p.network === "mtn" && Number(p.capacity_gb) === 1);
  ok("admin plans list loads", !!target, JSON.stringify(adminPlans.json?.error));
  if (!target) { console.log("\n  (skipping price-edit checks: no target plan)\n"); }
  const orig = target ? Number(target.retail_price_ghs) : 0;
  const edited = target ? await call("/api/admin/plans", {
    method: "PATCH", body: JSON.stringify({ id: target.id, retail_price_ghs: orig + 0.5 }),
  }, adminJar) : { json: {} };
  ok("admin can edit a price", edited.json?.ok === true && Number(edited.json?.data?.plan?.retail_price_ghs) === orig + 0.5);
  if (target) await call("/api/admin/plans", { method: "PATCH", body: JSON.stringify({ id: target.id, retail_price_ghs: orig }) }, adminJar);
  const restored = (await call("/api/admin/plans", {}, adminJar)).json?.data?.plans
    ?.find((p) => p.id === target?.id);
  ok("price restored", !!restored && Math.abs(Number(restored.retail_price_ghs) - orig) < 0.005);

  // ---------- UNMATCHED DEPOSIT => REVIEW ----------
  const stray = await fetch(BASE + "/api/webhook/sms-deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Webhook-Secret": SECRET },
    body: JSON.stringify({ text: "You have received GHS777.00 from 0200000000. Ref UNKNOWN9" }),
  });
  const strayJson = await stray.json();
  ok("unmatched deposit goes to review (never guessed)",
    strayJson?.data?.status === "unmatched_review", JSON.stringify(strayJson?.data));
  const queue = await call("/api/admin/deposits", {}, adminJar);
  ok("deposit appears in admin review queue", (queue.json?.data?.unmatched ?? []).length >= 1);

  // ---------- landing / logo asset ----------
  const logoRes = await fetch(BASE + "/logo.png");
  ok("logo.png is served", logoRes.status === 200, `(status ${logoRes.status})`);

  console.log("\n════════════════════════════════════════════════════════");
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) console.log("  Failed: " + failures.join(" | "));
  console.log("════════════════════════════════════════════════════════\n");
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
