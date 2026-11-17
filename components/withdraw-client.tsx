"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { gh } from "@/lib/money";

type W = {
  id: string;
  amount_ghs: string;
  fee_ghs: string;
  net_ghs: string;
  mode: string;
  status: string;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "text-ember-300",
  processing: "text-ember-300",
  paid: "text-ember-400",
  rejected: "text-flame-400",
};

export function WithdrawClient({ tier, balance }: { tier: string; balance: string }) {
  const { push } = useToast();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"instant" | "free_friday_batch">("instant");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<W[]>([]);
  const [bal, setBal] = useState(balance);

  const load = useCallback(async () => {
    try {
      const [w, me] = await Promise.all([
        fetch("/api/withdrawals").then((r) => r.json()),
        fetch("/api/auth/me").then((r) => r.json()),
      ]);
      if (w?.ok) setRows(w.data.withdrawals ?? []);
      if (me?.ok && me.data.wallet) setBal(me.data.wallet.balance_ghs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const n = Number(amount) || 0;
  const fee = mode === "instant" && tier !== "super_agent" ? Math.max(Math.round(n * 1.5) / 100, 0.5) : 0;
  const net = Math.max(0, n - fee);

  async function submit() {
    if (n <= 0) {
      push("Enter an amount.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, mode }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push(json?.error?.message || "Withdrawal failed.", "error");
        return;
      }
      push("Withdrawal requested.", "success");
      setAmount("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card card-pad">
        <p className="stat-label">Available to withdraw</p>
        <p className="mt-1 text-3xl font-black text-ember-50">{gh(bal)}</p>
      </div>

      <div className="card card-pad">
        <h2 className="text-base font-bold text-ember-50">Request a withdrawal</h2>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("instant")}
            className={`rounded-xl border p-3 text-left transition ${
              mode === "instant" ? "border-ember-500/70 bg-ember-600/10" : "border-coal-600 bg-coal-900/50"
            }`}
          >
            <p className="text-sm font-bold text-ember-100">Instant</p>
            <p className="mt-0.5 text-xs text-ember-100/55">
              {tier === "super_agent" ? "Zero fee for Super Agents" : "1.5% fee (min GH₵0.50)"}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("free_friday_batch")}
            className={`rounded-xl border p-3 text-left transition ${
              mode === "free_friday_batch" ? "border-ember-500/70 bg-ember-600/10" : "border-coal-600 bg-coal-900/50"
            }`}
          >
            <p className="text-sm font-bold text-ember-100">Free Friday batch</p>
            <p className="mt-0.5 text-xs text-ember-100/55">No fee · paid in the Friday batch</p>
          </button>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="amt">Amount</label>
          <input
            id="amt"
            className="input"
            inputMode="decimal"
            placeholder="e.g. 100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {n > 0 && (
          <dl className="mt-4 space-y-2 rounded-xl border border-coal-600 bg-coal-900/60 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ember-100/55">Amount</dt>
              <dd className="font-semibold text-ember-100">{gh(n)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ember-100/55">Fee</dt>
              <dd className="font-semibold text-ember-100">{fee > 0 ? gh(fee) : "Free"}</dd>
            </div>
            <div className="flex justify-between border-t border-coal-600/70 pt-2">
              <dt className="font-semibold text-ember-100">You receive</dt>
              <dd className="text-lg font-extrabold text-ember-300">{gh(net)}</dd>
            </div>
          </dl>
        )}

        <button type="button" onClick={submit} disabled={busy || n <= 0} className="btn-primary mt-4 w-full py-3">
          {busy ? "Requesting…" : "Request withdrawal"}
        </button>
        <p className="mt-2 text-center text-[11px] text-ember-100/40">Minimum withdrawal is GH₵5.00.</p>
      </div>

      <div className="card card-pad">
        <h2 className="mb-3 text-base font-bold text-ember-50">Withdrawal history</h2>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ember-100/40">No withdrawals yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Fee</th>
                  <th>Net</th>
                  <th>Mode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{gh(r.amount_ghs)}</td>
                    <td className="text-ember-100/60">{gh(r.fee_ghs)}</td>
                    <td className="font-semibold text-ember-300">{gh(r.net_ghs)}</td>
                    <td className="text-xs text-ember-100/55">
                      {r.mode === "instant" ? "Instant" : "Free Friday"}
                    </td>
                    <td className={`text-xs font-semibold capitalize ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
