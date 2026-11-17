"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { gh, NETWORK_LABEL, type Network } from "@/lib/money";

type Plan = {
  id: string;
  network: Network;
  size_label: string;
  capacity_gb: string;
  cost_price_ghs: string;
  retail_price_ghs: string;
  sub_agent_price_ghs: string;
  super_agent_price_ghs: string;
  active: boolean;
};

type Order = {
  id: string;
  recipient_phone: string;
  price_charged_ghs: string;
  buyer_tier_at_purchase: string;
  status: string;
  supplier_reference: string | null;
  failure_reason: string | null;
  created_at: string;
  network: Network;
  size_label: string;
  buyer_phone: string;
  buyer_name: string | null;
};

type Deposit = {
  id: string;
  amount_ghs: string;
  reference_code: string | null;
  sender_phone: string | null;
  raw_sms: string;
  status: string;
  created_at: string;
};

type Stats = Record<string, number>;

type Tab = "overview" | "pricing" | "orders" | "deposits";

const STATUS_COLOR: Record<string, string> = {
  delivered: "text-ember-400",
  processing: "text-ember-300",
  pending: "text-ember-300",
  failed: "text-flame-400",
  refunded: "text-flame-400",
};

export function AdminClient() {
  const { push } = useToast();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [unmatched, setUnmatched] = useState<Deposit[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolveFor, setResolveFor] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    const [s, p, o, d] = await Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/plans").then((r) => r.json()),
      fetch("/api/admin/orders").then((r) => r.json()),
      fetch("/api/admin/deposits").then((r) => r.json()),
    ]);
    if (s?.ok) setStats(s.data.stats ?? {});
    if (p?.ok) setPlans(p.data.plans ?? []);
    if (o?.ok) setOrders(o.data.orders ?? []);
    if (d?.ok) setUnmatched(d.data.unmatched ?? []);
    setUnlocked(s?.ok === true);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push(json?.error?.message || "Wrong PIN.", "error");
        return;
      }
      setPin("");
      await loadAll();
      push("Admin unlocked.", "success");
    } finally {
      setBusy(false);
    }
  }

  async function lock() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setUnlocked(false);
    push("Admin locked.", "info");
  }

  async function savePlan(p: Plan, field: keyof Plan, value: string) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      push("Enter a valid price.", "error");
      return;
    }
    const res = await fetch("/api/admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, [field]: num }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      push(json?.error?.message || "Could not save.", "error");
      return;
    }
    push(`${p.network.toUpperCase()} ${p.size_label} updated.`, "success");
    loadAll();
  }

  async function togglePlan(p: Plan) {
    const res = await fetch("/api/admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, active: !p.active }),
    });
    if (res.ok) {
      push(p.active ? "Bundle hidden." : "Bundle live.", "success");
      loadAll();
    }
  }

  async function resolveDeposit(d: Deposit) {
    const phone = (resolveFor[d.id] || "").trim();
    if (!phone) {
      push("Enter the customer's phone number.", "error");
      return;
    }
    const res = await fetch("/api/admin/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deposit_id: d.id, user_phone: phone }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      push(json?.error?.message || "Could not credit.", "error");
      return;
    }
    push("Deposit credited.", "success");
    loadAll();
  }

  if (unlocked === null) {
    return <div className="h-40 animate-pulse rounded-2xl bg-coal-800/60" />;
  }

  if (!unlocked) {
    return (
      <form onSubmit={unlock} className="card card-pad mx-auto max-w-sm">
        <h1 className="text-lg font-extrabold text-ember-50">Admin access</h1>
        <p className="mt-1 text-sm text-ember-100/55">Enter the admin PIN to continue.</p>
        <input
          className="input mt-4"
          type="password"
          inputMode="numeric"
          placeholder="Admin PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn-primary mt-3 w-full" disabled={busy}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "pricing", label: "Pricing" },
    { id: "orders", label: "Orders" },
    { id: "deposits", label: `Deposits${unmatched.length ? ` (${unmatched.length})` : ""}` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === t.id ? "bg-ember-600/15 text-ember-300" : "text-ember-100/60 hover:bg-coal-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={lock} className="btn-ghost !py-1.5 text-xs">
          Lock
        </button>
      </div>

      {tab === "overview" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "gross_revenue_ghs", l: "Gross revenue", money: true },
            { k: "orders_delivered", l: "Delivered orders" },
            { k: "orders_failed", l: "Failed / refunded" },
            { k: "total_users", l: "Total users" },
            { k: "sub_agents", l: "Sub-Agents" },
            { k: "super_agents", l: "Super Agents" },
            { k: "deposits_credited_ghs", l: "Deposits credited", money: true },
            { k: "wallets_float_ghs", l: "Wallet float", money: true },
          ].map((s) => (
            <div key={s.k} className="card card-pad">
              <p className="stat-label">{s.l}</p>
              <p className="stat-value">
                {s.money ? gh(stats[s.k] ?? 0) : (stats[s.k] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "pricing" && (
        <div className="card card-pad">
          <h2 className="text-base font-bold text-ember-50">Pricing table</h2>
          <p className="mt-1 text-sm text-ember-100/55">
            Edit any price and press Enter or click away to save. Changes apply immediately to new orders.
          </p>
          <div className="mt-4 table-wrap">
            <table className="tbl min-w-[820px]">
              <thead>
                <tr>
                  <th>Network</th>
                  <th>Bundle</th>
                  <th>Cost</th>
                  <th>Retail</th>
                  <th>Sub-Agent</th>
                  <th>Super Agent</th>
                  <th>Live</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap font-medium">{NETWORK_LABEL[p.network]}</td>
                    <td className="font-semibold">{p.size_label}</td>
                    {(["cost_price_ghs", "retail_price_ghs", "sub_agent_price_ghs", "super_agent_price_ghs"] as const).map((f) => (
                      <td key={f}>
                        <input
                          className="w-20 rounded-md border border-coal-600 bg-coal-900/70 px-2 py-1 text-sm text-ember-100 outline-none focus:border-ember-500/70"
                          defaultValue={Number(p[f]).toFixed(2)}
                          onBlur={(e) => {
                            if (Number(e.target.value) !== Number(p[f])) savePlan(p, f, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() => togglePlan(p)}
                        className={`rounded-md px-2 py-1 text-xs font-bold ${
                          p.active ? "bg-ember-600/20 text-ember-300" : "bg-coal-700 text-ember-100/50"
                        }`}
                      >
                        {p.active ? "Live" : "Off"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="card card-pad">
          <h2 className="mb-3 text-base font-bold text-ember-50">Orders ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-ember-100/40">No orders yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="tbl min-w-[760px]">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Bundle</th>
                    <th>Recipient</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Supplier ref</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="whitespace-nowrap">
                        <span className="font-medium">{o.buyer_name || o.buyer_phone}</span>
                        <span className="ml-1.5 rounded bg-coal-700 px-1.5 py-0.5 text-[10px] text-ember-200/70">
                          {o.buyer_tier_at_purchase}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {NETWORK_LABEL[o.network]} {o.size_label}
                      </td>
                      <td className="text-ember-100/60">{o.recipient_phone}</td>
                      <td className="font-semibold">{gh(o.price_charged_ghs)}</td>
                      <td className={`text-xs font-semibold capitalize ${STATUS_COLOR[o.status] ?? ""}`}>
                        {o.status}
                        {o.failure_reason && (
                          <span className="block text-[10px] font-normal text-ember-100/40">{o.failure_reason}</span>
                        )}
                      </td>
                      <td className="font-mono text-[11px] text-ember-100/50">{o.supplier_reference || "—"}</td>
                      <td className="whitespace-nowrap text-xs text-ember-100/45">
                        {new Date(o.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "deposits" && (
        <div className="card card-pad">
          <h2 className="text-base font-bold text-ember-50">Unmatched deposits ({unmatched.length})</h2>
          <p className="mt-1 text-sm text-ember-100/55">
            These payments could not be matched automatically. Credit the right customer manually.
          </p>
          {unmatched.length === 0 ? (
            <p className="py-8 text-center text-sm text-ember-100/40">Nothing to review.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {unmatched.map((d) => (
                <div key={d.id} className="rounded-xl border border-coal-600 bg-coal-900/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold text-ember-50">{gh(d.amount_ghs)}</p>
                      <p className="text-xs text-ember-100/50">
                        Ref: <span className="font-mono">{d.reference_code || "none"}</span> · From:{" "}
                        {d.sender_phone || "unknown"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="input !w-40 !py-1.5 text-sm"
                        placeholder="Customer phone"
                        value={resolveFor[d.id] || ""}
                        onChange={(e) => setResolveFor((r) => ({ ...r, [d.id]: e.target.value }))}
                      />
                      <button type="button" onClick={() => resolveDeposit(d)} className="btn-primary !py-1.5 text-xs">
                        Credit
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 rounded-lg bg-coal-900/80 p-2 font-mono text-[10px] leading-relaxed text-ember-100/40">
                    {d.raw_sms.slice(0, 300)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
