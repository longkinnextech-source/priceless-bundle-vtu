import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { NetworkBadge } from "@/components/network-badge";
import { NETWORKS } from "@/lib/money";

export const metadata: Metadata = { title: "Agent Programme" };

export default function AgentLandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="text-center">
        <span className="chip mb-4">Agent Programme</span>
        <h1 className="text-3xl font-black tracking-tight text-ember-50 sm:text-4xl">
          Sell data. Keep the margin.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ember-100/60">
          Start free as a Sub-Agent, or commit GH₵500 to your wallet to unlock Super Agent wholesale
          pricing, zero-fee payouts and your own squad.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="card card-pad">
          <h2 className="text-lg font-extrabold text-ember-50">Sub-Agent</h2>
          <p className="mt-1 text-sm font-semibold text-ember-300">Free to join</p>
          <ul className="mt-4 space-y-2 text-sm text-ember-100/70">
            {[
              "Agent pricing on every bundle",
              "Join a Super Agent's squad",
              "Earn commission on squad sales",
              "Reinvest commission for a 3.5% bonus",
              "Instant withdrawal (1.5% fee) or free Friday batch",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-ember-500">✓</span> {x}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn-ghost mt-5 w-full">Sign up free</Link>
        </div>

        <div className="card card-pad border-ember-600/50 shadow-ember">
          <h2 className="text-lg font-extrabold text-ember-50">Super Agent</h2>
          <p className="mt-1 text-sm font-semibold text-ember-300">GH₵500 wallet commitment</p>
          <ul className="mt-4 space-y-2 text-sm text-ember-100/70">
            {[
              "VIP wholesale pricing",
              "Zero-fee instant withdrawals",
              "Recruit Sub-Agents into your squad",
              "Squad volume target keeps everyone's tier",
              "Bot-in-a-box: your own Telegram or WhatsApp store",
            ].map((x) => (
              <li key={x} className="flex gap-2">
                <span className="text-ember-500">✓</span> {x}
              </li>
            ))}
          </ul>
          <Link href="/wallet" className="btn-primary mt-5 w-full">Top up to unlock</Link>
        </div>
      </div>

      <div className="card card-pad mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <p className="text-sm font-bold text-ember-50">Already an agent?</p>
              <p className="text-xs text-ember-100/50">Open your dashboard for your squad and recruit link.</p>
            </div>
          </div>
          <Link href="/agent" className="btn-ghost">Open dashboard</Link>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {NETWORKS.map((n) => (
          <NetworkBadge key={n} network={n} />
        ))}
      </div>
    </div>
  );
}
