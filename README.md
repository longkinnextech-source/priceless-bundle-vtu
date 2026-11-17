# Priceless Bundle

A production-quality VTU (mobile data reselling) platform for Ghana, built by **LongKinnex Tech and Data**.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres)

---

## Quick start (phone-friendly)

1. **Supabase** → create a project → SQL Editor → paste all of `supabase/schema.sql` → **Run**.
2. **Vercel** (or any Node host) → import the repo → add the environment variables below → Deploy.
3. Open `/admin` → enter your `ADMIN_PIN` → edit prices, watch orders.

---

## What it does

- **Buy data** — MTN, Telecel and AirtelTigo bundles at tier-based prices (customer / Sub-Agent / Super Agent). Price is resolved **server-side** from the buyer's own tier — a client-sent price is never trusted.
- **Real DataMartGH integration** — `POST /api/purchase` with `X-API-Key` + `X-Idempotency-Key` (the order's own ID). Network codes: `mtn → YELLO`, `telecel → TELECEL`, `airteltigo → AT_PREMIUM`. Success stores `data.orderReference` as the order's `supplier_reference`; an error message (e.g. "Insufficient wallet balance") surfaces as the failure reason and **auto-refunds** the buyer. Without `DATAMART_API_KEY` it falls back to a simulated success rate so the whole app works end-to-end before a live key is added.
- **MTN number verification** — before an MTN purchase, `POST /api/developer/verify-number` checks the recipient. `servable: false` blocks the purchase button and shows the returned message (new-beneficiary freeze: sell 1GB first, allow up to 72h). Telecel/AirtelTigo skip the check. Debounced on the Buy Data page.
- **Automatic payment collection** — no third-party gateway. The user requests a top-up, gets a short reference code (`PB-4X7Q`) + a MoMo/Telecel Cash collection number. An Android SMS-forwarder app posts the payment SMS to `/api/webhook/sms-deposit` (protected by `X-Webhook-Secret`). The webhook parses the SMS defensively (never throws, logs the raw payload first), matches by reference code, then by amount + time window, and **never guesses** — ambiguous or unmatched payments go to `unmatched_review` for the admin queue. A confident match credits the wallet **atomically** in one Postgres function.
- **Wallets & ledger** — `wallets` can never go negative; `wallet_ledger` is an immutable, append-only log of every movement (deposit, purchase, commission, reinvest_bonus, p2p_send/receive, withdrawal, withdrawal_fee, refund), each row snapshotting `balance_after`.
- **Agent tiers & squads** — Sub-Agent: free, agent pricing. Super Agent: unlocked by a GH₵500 wallet commitment, VIP pricing, zero-fee instant payouts. Super Agents recruit Sub-Agents into a Squad; combined delivered volume is recomputed after every purchase and compared against the monthly target — hitting it retains the whole squad's discount tier.
- **Withdrawals & commission** — reinvesting commission into the main wallet applies a 2–5% bonus by tier; P2P transfers between any two users; Sub-Agents pay a small instant-withdrawal fee or choose the free "Free Friday" batch; Super Agents withdraw instantly for free.
- **Bot-in-a-box** — Super Agents can save their own Telegram bot token or WhatsApp Business endpoint; purchases through their bot execute at their wholesale tier and count toward their squad via `bot_orders`.
- **Admin panel** — editable pricing table (writes to `plans`), full orders list, unmatched-deposit review queue, revenue overview. Gated behind a shared admin PIN (`ADMIN_PIN`) — never open to anyone with the URL.

## Pages

`/` landing · `/buy` buy data · `/wallet` top-up + history · `/agent` agent dashboard (squad, recruit link) · `/withdraw` withdrawals · `/admin` admin panel · `/login` `/signup` · `/join/[ref]` squad recruit link

---

## Environment variables

Copy `.env.example` to `.env.local` (or paste these into your host's dashboard):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Postgres connection string — `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `SESSION_SECRET` | ✅ | Long random string — signs login cookies |
| `ADMIN_PIN` | ✅ | The shared PIN that unlocks `/admin` |
| `SMS_WEBHOOK_SECRET` | ✅ | Shared secret the SMS-forwarder sends as `X-Webhook-Secret` |
| `DATAMART_API_KEY` | ⬜ | Your DataMartGH API key. **Leave empty to run in simulated mode** |
| `MOMO_COLLECTION_NUMBER` | ⬜ | The MoMo/Telecel Cash number shown to customers |
| `DATAMART_BASE_URL` | ⬜ | Defaults to `https://api.datamartgh.shop/api` |

---

## Database setup (Supabase)

1. Create a Supabase project (free tier is fine).
2. Open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → **Run**.
   It is idempotent (safe to re-run) and seeds 33 bundles across the three networks.
3. Grab the connection string from **Project Settings → Database → Connection string → URI** and use it as `DATABASE_URL`.
4. (Optional) Make yourself an admin: register in the app, then in the SQL editor run
   `select fn_make_admin('024XXXXXXX');`

---

## Wire the SMS forwarder (Android)

Install an SMS-forwarder app (e.g. **SMS Forwarder** on the Play Store) on the phone that receives the MoMo/Telecel Cash payment SMS. Forward new SMS to:

```
https://<your-domain>/api/webhook/sms-deposit
```

with header `X-Webhook-Secret: <your SMS_WEBHOOK_SECRET>` and body `{"text": "<the sms text>"}` (or a plain-text body). The webhook logs the raw payload, parses it, matches it to a deposit intent, and credits the wallet.

## Go live with DataMartGH

Set `DATAMART_API_KEY` and restart. Every purchase then hits the real supplier; failures auto-refund. The MTN number check also becomes live.

---

## Tests

All tests run against a **real Postgres** database (never mocked):

```bash
# 1) apply the schema
DATABASE_URL="postgres://..." npm run db:apply

# 2) core money logic — 54 assertions
DATABASE_URL="postgres://..." npm run test:db

# 3) phone+PIN auth — 8 assertions
DATABASE_URL="postgres://..." node scripts/test-auth.mjs

# 4) full HTTP end-to-end (needs the app running: npm run build && npm start)
BASE_URL=http://localhost:3000 SMS_WEBHOOK_SECRET=... ADMIN_PIN=... node scripts/test-e2e.mjs
```

The e2e suite walks the **wallet top-up flow** (intent → SMS webhook → atomic credit → ledger) and the **buy-data flow** (plans → verify → atomic debit → supplier → finalize/refund) exactly as a browser would, plus auth, P2P, withdrawals, admin PIN gate and the unmatched-deposit queue.

---

## Notes

- Only company name in the app: **LongKinnex Tech and Data** (footer only).
- Network brand colours (MTN yellow, Telecel red, AirtelTigo blue) appear **only** on network badges.
- The logo lives at `/public/logo.png` and is referenced by the navbar, footer, splash screen, login page, favicon and metadata.
- Withdrawals are recorded as requests (`pending`) — paying them out is a manual/ops step until a payout rail is connected.
