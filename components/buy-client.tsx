"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NetworkBadge } from "@/components/network-badge";
import { useToast } from "@/components/toast";
import { gh, NETWORK_LABEL, NETWORKS, normalizePhone, isValidGhanaPhone, type Network } from "@/lib/money";

type Plan = {
  id: string;
  network: Network;
  size_label: string;
  capacity_gb: number;
  price_ghs: number;
  retail_price_ghs: number;
};

type VerifyState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; message: string }
  | { kind: "blocked"; message: string };

export function BuyClient({ initialTier }: { initialTier: string }) {
  const { push } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tier, setTier] = useState(initialTier);
  const [network, setNetwork] = useState<Network>("mtn");
  const [selected, setSelected] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [verify, setVerify] = useState<VerifyState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setPlans(d.data.plans ?? []);
          setTier(d.data.tier ?? "customer");
        }
      })
      .catch(() => push("Could not load bundles.", "error"))
      .finally(() => setLoadingPlans(false));
  }, [push]);

  const networkPlans = useMemo(() => plans.filter((p) => p.network === network), [plans, network]);
  const chosen = useMemo(() => plans.find((p) => p.id === selected) ?? null, [plans, selected]);

  // Reset selection when switching network
  useEffect(() => {
    setSelected(null);
  }, [network]);

  // MTN-only pre-purchase number verification, debounced.
  const runVerify = useCallback(
    async (phone: string) => {
      const id = ++reqIdRef.current;
      setVerify({ kind: "checking" });
      try {
        const res = await fetch("/api/verify-number", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        const json = await res.json();
        if (id !== reqIdRef.current) return; // stale response
        if (!res.ok || !json.ok) {
          setVerify({ kind: "blocked", message: json?.error?.message || "Could not verify this number." });
          return;
        }
        const d = json.data as { servable: boolean; message: string };
        setVerify(d.servable ? { kind: "ok", message: d.message } : { kind: "blocked", message: d.message });
      } catch {
        if (id !== reqIdRef.current) return;
        setVerify({ kind: "idle" });
      }
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (network !== "mtn") {
      setVerify({ kind: "idle" });
      return;
    }
    const phone = normalizePhone(recipient);
    if (!isValidGhanaPhone(phone)) {
      setVerify({ kind: "idle" });
      return;
    }
    debounceRef.current = setTimeout(() => runVerify(phone), 650);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [recipient, network, runVerify]);

  const blocked = network === "mtn" && verify.kind === "blocked";
  const canBuy =
    !!chosen && isValidGhanaPhone(recipient) && !blocked && verify.kind !== "checking" && !busy;

  async function buy() {
    if (!chosen) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: chosen.id, recipient_phone: normalizePhone(recipient) }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push(json?.error?.message || "Purchase failed.", "error");
        setResult({ status: "failed", message: json?.error?.message || "Purchase failed." });
        return;
      }
      const o = json.data.order as { status: string; failure_reason: string | null };
      if (o.status === "delivered") {
        push("Bundle delivered.", "success");
        setResult({ status: "delivered", message: `${chosen.size_label} sent to ${normalizePhone(recipient)}.` });
      } else if (o.status === "refunded") {
        push("Order refunded to your wallet.", "error");
        setResult({ status: "refunded", message: o.failure_reason || "The supplier rejected this order. You were refunded in full." });
      } else {
        setResult({ status: o.status, message: "Order is processing." });
      }
      setRecipient("");
      setSelected(null);
      setVerify({ kind: "idle" });
    } catch {
      push("Network error. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      {/* LEFT: picker */}
      <div className="space-y-5">
        <div className="card card-pad">
          <p className="label">1 · Choose network</p>
          <div className="grid grid-cols-3 gap-2">
            {NETWORKS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 transition ${
                  network === n
                    ? "border-ember-500/70 bg-ember-600/10"
                    : "border-coal-600 bg-coal-900/50 hover:border-coal-500"
                }`}
              >
                <NetworkBadge network={n} />
                <span className={`text-xs font-semibold ${network === n ? "text-ember-300" : "text-ember-100/60"}`}>
                  {NETWORK_LABEL[n]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <p className="label !mb-0">2 · Choose bundle</p>
            <span className="chip !text-[10px]">
              {tier === "super_agent" ? "Super Agent rate" : tier === "sub_agent" ? "Agent rate" : "Retail rate"}
            </span>
          </div>

          {loadingPlans ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[68px] animate-pulse rounded-xl bg-coal-800/70" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {networkPlans.map((p) => {
                const active = selected === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-ember-500/80 bg-ember-600/12 shadow-ember-sm"
                        : "border-coal-600 bg-coal-900/50 hover:border-coal-500"
                    }`}
                  >
                    <p className={`text-sm font-bold ${active ? "text-ember-200" : "text-ember-100"}`}>
                      {p.size_label}
                    </p>
                    <p className={`mt-0.5 text-xs font-semibold ${active ? "text-ember-300" : "text-ember-100/55"}`}>
                      {gh(p.price_ghs)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <p className="label">3 · Recipient number</p>
          <div className="relative">
            <input
              className="input pr-24"
              inputMode="tel"
              placeholder="024 000 0000"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            {network === "mtn" && verify.kind === "checking" && (
              <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[11px] font-medium text-ember-300">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-400" />
                Checking
              </span>
            )}
            {network === "mtn" && verify.kind === "ok" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ember-400">
                ✓ Ready
              </span>
            )}
          </div>

          {network === "mtn" && verify.kind === "blocked" && (
            <div className="mt-3 rounded-xl border border-flame-600/40 bg-flame-700/12 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-flame-400">Number cannot receive data yet</p>
              <p className="mt-1 text-sm leading-relaxed text-ember-100/75">{verify.message}</p>
            </div>
          )}

          {network === "mtn" && verify.kind === "ok" && (
            <p className="mt-2 text-xs text-ember-100/45">{verify.message}</p>
          )}

          {network !== "mtn" && (
            <p className="mt-2 text-xs text-ember-100/40">
              {NETWORK_LABEL[network]} numbers do not need a pre-check.
            </p>
          )}
        </div>
      </div>

      {/* RIGHT: summary */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="card card-pad">
          <p className="text-sm font-bold text-ember-50">Order summary</p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ember-100/55">Network</dt>
              <dd className="font-semibold text-ember-100">{NETWORK_LABEL[network]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ember-100/55">Bundle</dt>
              <dd className="font-semibold text-ember-100">{chosen?.size_label ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ember-100/55">Recipient</dt>
              <dd className="font-semibold text-ember-100">{recipient ? normalizePhone(recipient) : "—"}</dd>
            </div>
            <div className="mt-3 flex justify-between border-t border-coal-600/70 pt-3">
              <dt className="font-semibold text-ember-100">You pay</dt>
              <dd className="text-lg font-extrabold text-ember-300">{chosen ? gh(chosen.price_ghs) : "—"}</dd>
            </div>
          </dl>

          <button type="button" onClick={buy} disabled={!canBuy} className="btn-primary mt-5 w-full py-3">
            {busy ? "Sending…" : blocked ? "Number blocked" : "Buy bundle"}
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-ember-100/40">
            Charged from your wallet. If the supplier rejects the order, you are refunded automatically.
          </p>

          {result && (
            <div
              className={`mt-4 rounded-xl border p-3 text-sm ${
                result.status === "delivered"
                  ? "border-ember-500/40 bg-ember-600/12 text-ember-100"
                  : "border-flame-600/40 bg-flame-700/12 text-ember-100/80"
              }`}
            >
              <p className="font-semibold">
                {result.status === "delivered" ? "Delivered" : result.status === "refunded" ? "Refunded" : "Update"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-80">{result.message}</p>
            </div>
          )}

          <Link href="/wallet" className="btn-ghost mt-3 w-full">
            Top up wallet
          </Link>
        </div>
      </div>
    </div>
  );
}
