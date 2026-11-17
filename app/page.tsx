import Link from "next/link";
import { Logo } from "@/components/logo";
import { NetworkBadge } from "@/components/network-badge";
import { Splash } from "@/components/splash";
import { NETWORKS } from "@/lib/money";

export default function HomePage() {
  return (
    <>
      <Splash />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="animate-fade-up">
              <span className="chip mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
                Live in Ghana · MTN · Telecel · AirtelTigo
              </span>

              <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-ember-50 sm:text-5xl lg:text-6xl">
                Data that never
                <br />
                <span className="bg-fire-gradient bg-clip-text text-transparent">overcharges.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-ember-100/65 sm:text-lg">
                Buy bundles at agent prices, top up your wallet once, and send data to any number in
                seconds. No middlemen, no inflated rates, no waiting on a WhatsApp reply.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/buy" className="btn-primary px-6 py-3 text-base">
                  Buy data now
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
                <Link href="/agent" className="btn-ghost px-6 py-3 text-base">
                  Become an agent
                </Link>
              </div>

              <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-coal-700/60 pt-6">
                {[
                  { k: "Instant", v: "Delivery" },
                  { k: "3", v: "Networks" },
                  { k: "0%", v: "Hidden fees" },
                ].map((s) => (
                  <div key={s.v}>
                    <p className="text-xl font-extrabold text-ember-300">{s.k}</p>
                    <p className="text-xs uppercase tracking-wider text-ember-100/45">{s.v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Price card mock */}
            <div className="animate-fade-up [animation-delay:120ms]">
              <div className="card card-pad relative overflow-hidden">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-ember-600/20 blur-3xl" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Logo size={32} />
                    <div>
                      <p className="text-sm font-bold text-ember-50">Today&apos;s prices</p>
                      <p className="text-[11px] text-ember-100/45">Agent rate · per bundle</p>
                    </div>
                  </div>
                  <span className="chip !border-ember-600/40 !bg-ember-600/10 !text-ember-300">Live</span>
                </div>

                <div className="mt-5 space-y-2.5">
                  {[
                    { net: "mtn" as const, size: "1GB", price: "4.20" },
                    { net: "telecel" as const, size: "5GB", price: "18.00" },
                    { net: "airteltigo" as const, size: "10GB", price: "34.50" },
                    { net: "mtn" as const, size: "20GB", price: "70.00" },
                  ].map((r) => (
                    <div
                      key={r.net + r.size}
                      className="flex items-center justify-between rounded-xl border border-coal-600/60 bg-coal-900/60 px-3.5 py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <NetworkBadge network={r.net} size="sm" />
                        <span className="text-sm font-semibold text-ember-100">{r.size}</span>
                      </div>
                      <span className="text-sm font-bold text-ember-300">GH₵{r.price}</span>
                    </div>
                  ))}
                </div>

                <Link href="/buy" className="btn-ghost mt-4 w-full">
                  See all bundles
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NETWORKS */}
      <section className="border-y border-coal-700/60 bg-coal-900/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-ember-100/40">
            All three networks
          </p>
          {NETWORKS.map((n) => (
            <NetworkBadge key={n} network={n} />
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">
            Three steps. That&apos;s the whole thing.
          </h2>
          <p className="mt-2 text-ember-100/60">
            Top up once, then buy as often as you like. Your wallet balance is always visible and every
            movement is logged.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              n: "01",
              t: "Top up your wallet",
              d: "Send Mobile Money to our collection number with your short reference code. Your balance is credited automatically.",
            },
            {
              n: "02",
              t: "Pick a bundle",
              d: "Choose the network and size. Your price is resolved from your own tier — customer, Sub-Agent or Super Agent.",
            },
            {
              n: "03",
              t: "Send to any number",
              d: "Enter the recipient, confirm, and the bundle is delivered. If the supplier rejects it, you are refunded automatically.",
            },
          ].map((s) => (
            <div key={s.n} className="card card-pad">
              <span className="text-xs font-black tracking-widest text-ember-600">{s.n}</span>
              <h3 className="mt-2 text-base font-bold text-ember-50">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ember-100/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TIERS */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">
            Three tiers. One price list.
          </h2>
          <p className="mt-2 text-ember-100/60">
            Everyone sees the same bundles. What changes is your rate — and how much you earn when your
            squad sells.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              name: "Customer",
              price: "Free",
              tag: "Buy for yourself",
              perks: ["Retail pricing on every bundle", "Wallet top-up and full history", "Instant delivery to any number"],
              cta: "Create account",
              href: "/signup",
              featured: false,
            },
            {
              name: "Sub-Agent",
              price: "Free",
              tag: "Resell and earn",
              perks: [
                "Agent pricing on every bundle",
                "Join a Super Agent's squad",
                "Commission reinvest bonus",
                "Instant withdrawal (small fee) or free Friday batch",
              ],
              cta: "Sign up as agent",
              href: "/signup",
              featured: true,
            },
            {
              name: "Super Agent",
              price: "GH₵500 commitment",
              tag: "Run a squad",
              perks: [
                "VIP wholesale pricing",
                "Zero-fee instant withdrawals",
                "Recruit Sub-Agents into your squad",
                "Bot-in-a-box: your own Telegram or WhatsApp store",
              ],
              cta: "See the programme",
              href: "/agent",
              featured: false,
            },
          ].map((t) => (
            <div
              key={t.name}
              className={`card card-pad relative flex flex-col ${
                t.featured ? "border-ember-600/50 shadow-ember" : ""
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-5 rounded-full bg-fire-gradient px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-coal-900">
                  Most popular
                </span>
              )}
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ember-200/50">{t.tag}</p>
              <h3 className="mt-1 text-xl font-extrabold text-ember-50">{t.name}</h3>
              <p className="mt-1 text-sm font-semibold text-ember-300">{t.price}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2.5 text-sm text-ember-100/70">
                    <svg className="mt-0.5 shrink-0 text-ember-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {p}
                  </li>
                ))}
              </ul>

              <Link href={t.href} className={`mt-6 w-full ${t.featured ? "btn-primary" : "btn-ghost"}`}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="card relative overflow-hidden p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-fire-soft" />
          <div className="relative">
            <h2 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">
              Stop paying retail for data.
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-ember-100/60">
              Create a free account, top up, and buy your first bundle in under two minutes.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="btn-primary px-6 py-3">Create free account</Link>
              <Link href="/buy" className="btn-ghost px-6 py-3">Browse bundles</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
