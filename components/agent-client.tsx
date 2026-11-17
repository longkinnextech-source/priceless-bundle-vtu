"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { gh, TIER_LABEL } from "@/lib/money";

type Squad = {
  id: string;
  name: string;
  volume_target_ghs: string;
  current_volume_ghs: string;
  tier_retained: boolean;
  current_period_start: string;
};

type Member = { id: string; name: string | null; phone: string; tier: string };

export function AgentClient({
  userId,
  tier,
  phone,
}: {
  userId: string;
  tier: string;
  phone: string;
}) {
  const { push } = useToast();
  const [squad, setSquad] = useState<Squad | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [upgrade, setUpgrade] = useState<{ commitment_ghs: number; balance_ghs: number; eligible: boolean } | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("500");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [sq, up] = await Promise.all([
        fetch("/api/squad").then((r) => r.json()),
        fetch("/api/agent/upgrade").then((r) => r.json()),
      ]);
      if (sq?.ok) {
        setSquad(sq.data.overview?.squad ?? null);
        setMembers(sq.data.overview?.members ?? []);
        if (sq.data.overview?.squad) {
          setName(sq.data.overview.squad.name ?? "");
          setTarget(String(Number(sq.data.overview.squad.volume_target_ghs ?? 0)));
        }
      }
      if (up?.ok) setUpgrade(up.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recruitLink = typeof window !== "undefined" ? `${window.location.origin}/join/${userId}` : `/join/${userId}`;

  async function saveSquad() {
    setBusy(true);
    try {
      const res = await fetch("/api/squad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, volume_target_ghs: Number(target) || 0 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push(json?.error?.message || "Could not save the squad.", "error");
        return;
      }
      push("Squad saved.", "success");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function doUpgrade() {
    setBusy(true);
    try {
      const res = await fetch("/api/agent/upgrade", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push(json?.error?.message || "Upgrade failed.", "error");
        return;
      }
      push("You are now a Super Agent.", "success");
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(recruitLink);
      push("Recruit link copied.", "success");
    } catch {
      push("Could not copy — long-press to select.", "error");
    }
  }

  const pct = squad && Number(squad.volume_target_ghs) > 0
    ? Math.min(100, (Number(squad.current_volume_ghs) / Number(squad.volume_target_ghs)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Tier card */}
      <div className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="stat-label">Your tier</p>
            <p className="mt-1 text-2xl font-black text-ember-50">{TIER_LABEL[tier] ?? tier}</p>
            <p className="mt-0.5 text-xs text-ember-100/45">{phone}</p>
          </div>
          {tier !== "super_agent" && upgrade && (
            <div className="text-right">
              <p className="text-xs text-ember-100/55">
                {gh(upgrade.balance_ghs)} of {gh(upgrade.commitment_ghs)} commitment
              </p>
              <button
                type="button"
                onClick={doUpgrade}
                disabled={!upgrade.eligible || busy}
                className="btn-primary mt-2"
              >
                {upgrade.eligible ? "Upgrade to Super Agent" : "Top up to unlock"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Squad */}
      {tier === "super_agent" ? (
        <>
          <div className="card card-pad">
            <h2 className="text-base font-bold text-ember-50">Your squad</h2>
            <p className="mt-1 text-sm text-ember-100/55">
              Combined delivered volume from your squad this month. Hit the target and the whole squad
              keeps its discount tier.
            </p>

            {loading ? (
              <div className="mt-4 h-24 animate-pulse rounded-xl bg-coal-800/60" />
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-coal-600 bg-coal-900/60 p-3">
                    <p className="stat-label">Volume this period</p>
                    <p className="mt-1 text-xl font-extrabold text-ember-50">
                      {gh(squad?.current_volume_ghs ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-coal-600 bg-coal-900/60 p-3">
                    <p className="stat-label">Target</p>
                    <p className="mt-1 text-xl font-extrabold text-ember-100">
                      {gh(squad?.volume_target_ghs ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-coal-600 bg-coal-900/60 p-3">
                    <p className="stat-label">Tier status</p>
                    <p className={`mt-1 text-xl font-extrabold ${squad?.tier_retained ? "text-ember-400" : "text-ember-100/60"}`}>
                      {squad?.tier_retained ? "Retained" : "In progress"}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="h-2.5 overflow-hidden rounded-full bg-coal-700">
                    <div className="h-full rounded-full bg-fire-gradient transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-ember-100/45">{pct.toFixed(0)}% of target</p>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <input className="input" placeholder="Squad name" value={name} onChange={(e) => setName(e.target.value)} />
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="Target GH₵"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                  <button type="button" onClick={saveSquad} disabled={busy} className="btn-ghost">
                    Save
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="card card-pad">
            <h2 className="text-base font-bold text-ember-50">Recruit Sub-Agents</h2>
            <p className="mt-1 text-sm text-ember-100/55">
              Share this link. Anyone who signs up through it joins your squad and their sales count
              toward your volume.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="input font-mono text-xs" readOnly value={recruitLink} />
              <button type="button" onClick={copyLink} className="btn-primary shrink-0">
                Copy link
              </button>
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="text-base font-bold text-ember-50">Squad members ({members.length})</h2>
            {members.length === 0 ? (
              <p className="py-6 text-center text-sm text-ember-100/40">
                No members yet. Share your recruit link to start building.
              </p>
            ) : (
              <div className="mt-3 table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td className="font-medium">{m.name || "—"}</td>
                        <td className="text-ember-100/60">{m.phone}</td>
                        <td>{TIER_LABEL[m.tier] ?? m.tier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card card-pad">
          <h2 className="text-base font-bold text-ember-50">Join a squad</h2>
          <p className="mt-1 text-sm text-ember-100/55">
            Ask your Super Agent for their recruit link. Joining a squad keeps your agent pricing and
            helps the whole team retain its tier.
          </p>
          <p className="mt-3 rounded-lg border border-coal-600 bg-coal-900/60 px-3 py-2 text-xs text-ember-100/50">
            Already have a link? Open it on this phone and you will be added automatically.
          </p>
        </div>
      )}
    </div>
  );
}
