"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { gh } from "@/lib/money";

type LedgerRow = {
  id: string;
  type: string;
  bucket: string;
  amount_ghs: string;
  balance_after: string;
  reference: string | null;
  created_at: string;
};

type Intent = {
  id: string;
  reference_code: string;
  expected_amount_ghs: string;
  status: string;
  expires_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  deposit: "Top-up",
  purchase: "Data purchase",
  commission: "Commission",
  reinvest_bonus: "Reinvest bonus",
  p2p_send: "Sent to user",
  p2p_receive: "Received from user",
  withdrawal: "Withdrawal",
  withdrawal_fee: "Withdrawal fee",
  refund: "Refund",
  adjustment: "Transfer",
};

const QUICK = [10, 20, 50, 100, 200];

export function WalletClient({ tier }: { tier: string }) {
  const { push } = useToast();
  const [balance, setBalance] = useState("0");
  const [commission, setCommission] = useState("0");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [amount, setAmount] = useState("20");
  const [busy, setBusy] = useState(false);
  const [topup, setTopup] = useState<{ code: string; number: string; instructions: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet");
      const json = await res.json();
      if (json?.ok) {
        setBalance(json.data.wallet?.balance_ghs ?? "0");
        setCommission(json.data.wallet?.commission_balance_ghs ?? "0");
        setLedger(json.data.ledger ?? []);
        setIntents(json.data.pending_intents ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function requestTopup() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      push("Enter a valid amount.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/deposits/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push(json?.error?.message || "Could not start the top-up.", "error");
        return;
      }
      setTopup({
        code: json.data.intent.reference_code,
        number: json.data.collection_number,
        instructions: json.data.instructions,
      });
      push("Reference created. Send the exact amount now.", "success");
      load();
    } catch {
      push("Network error.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      push(`${label} copied.`, "success");
    } catch {
      push("Could not copy — long-press to select.", "error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Balances */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card card-pad relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-ember-600/20 blur-2xl" />
          <p className="stat-label">Wallet balance</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-ember-50">{gh(balance)}</p>
          <p className="mt-1 text-xs text-ember-100/45">Spendable on any bundle</p>
        </div>
        <div className="card card-pad">
          <p className="stat-label">Commission balance</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-ember-300">{gh(commission)}</p>
          <p className="mt-1 text-xs text-ember-100/45">
            {tier === "super_agent" ? "Reinvest for a 5% bonus" : tier === "sub_agent" ? "Reinvest for a 3.5% bonus" : "Reinvest for a 2% bonus"}
          </p>
        </div>
      </div>

      {/* Top up */}
      <div className="card card-pad">
        <h2 className="text-base font-bold text-ember-50">Top up your wallet</h2>
        <p className="mt-1 text-sm text-ember-100/55">
          Send Mobile Money to our collection number. Your balance is credited automatically when the
          payment SMS arrives.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                Number(amount) === q
                  ? "border-ember-500/70 bg-ember-600/12 text-ember-300"
                  : "border-coal-600 bg-coal-900/50 text-ember-100/70 hover:border-coal-500"
              }`}
            >
              GH₵{q}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="input sm:max-w-[200px]"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in GH₵"
          />
          <button type="button" onClick={requestTopup} disabled={busy} className="btn-primary">
            {busy ? "Creating…" : "Get payment reference"}
          </button>
        </div>

        {topup && (
          <div className="mt-4 rounded-xl border border-ember-600/40 bg-ember-600/8 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ember-300">Send exactly this</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-coal-600 bg-coal-900/70 p-3">
                <p className="text-[10px] uppercase tracking-wider text-ember-100/40">Amount</p>
                <p className="mt-0.5 text-lg font-extrabold text-ember-50">{gh(amount)}</p>
              </div>
              <div className="rounded-lg border border-coal-600 bg-coal-900/70 p-3">
                <p className="text-[10px] uppercase tracking-wider text-ember-100/40">Collection number</p>
                <button
                  type="button"
                  onClick={() => copy(topup.number, "Number")}
                  className="mt-0.5 text-lg font-extrabold text-ember-50 hover:text-ember-300"
                >
                  {topup.number}
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-ember-500/40 bg-coal-900/70 p-3">
              <p className="text-[10px] uppercase tracking-wider text-ember-100/40">Reference code</p>
              <button
                type="button"
                onClick={() => copy(topup.code, "Reference")}
                className="mt-0.5 text-2xl font-black tracking-widest text-ember-300 hover:text-ember-200"
              >
                {topup.code}
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ember-100/60">{topup.instructions}</p>
          </div>
        )}

        {intents.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ember-200/50">
              Waiting for payment
            </p>
            {intents.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-lg border border-coal-600 bg-coal-900/50 px-3 py-2 text-sm"
              >
                <span className="font-mono font-bold text-ember-300">{i.reference_code}</span>
                <span className="text-ember-100/60">{gh(i.expected_amount_ghs)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ember-50">Transaction history</h2>
          <button type="button" onClick={load} className="text-xs font-semibold text-ember-300 hover:underline">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-coal-800/60" />
            ))}
          </div>
        ) : ledger.length === 0 ? (
          <p className="py-8 text-center text-sm text-ember-100/40">
            No transactions yet. Top up to get started.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance after</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => {
                  const amt = Number(r.amount_ghs);
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="font-medium">{TYPE_LABEL[r.type] ?? r.type}</span>
                        {r.bucket === "commission" && (
                          <span className="ml-1.5 rounded bg-coal-700 px-1.5 py-0.5 text-[10px] text-ember-200/70">
                            commission
                          </span>
                        )}
                      </td>
                      <td className={amt >= 0 ? "font-semibold text-ember-400" : "font-semibold text-flame-400"}>
                        {amt >= 0 ? "+" : "−"}
                        {gh(Math.abs(amt))}
                      </td>
                      <td className="text-ember-100/60">{gh(r.balance_after)}</td>
                      <td className="whitespace-nowrap text-xs text-ember-100/45">
                        {new Date(r.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
