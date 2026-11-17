"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./logo";

const NAV = [
  { href: "/buy", label: "Buy Data" },
  { href: "/wallet", label: "Wallet" },
  { href: "/agent", label: "Agents" },
  { href: "/withdraw", label: "Withdraw" },
];

type Me = { user: { id: string; phone: string; name: string | null; tier: string } | null };

export function SiteHeader() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me["user"]>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setMe(d?.data?.user ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-coal-700/70 bg-coal-900/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo size={34} />
          <span className="text-[15px] font-extrabold tracking-tight text-ember-50">
            Priceless <span className="bg-fire-gradient bg-clip-text text-transparent">Bundle</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-ember-600/15 text-ember-300" : "text-ember-100/70 hover:bg-coal-800 hover:text-ember-100"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {me ? (
            <Link href="/wallet" className="btn-ghost">
              <span className="h-1.5 w-1.5 rounded-full bg-ember-400" />
              {me.name || me.phone}
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Log in</Link>
              <Link href="/signup" className="btn-primary">Get started</Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost !px-3 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-coal-700/70 bg-coal-900/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ember-100/80 hover:bg-coal-800"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-coal-700/70 pt-3">
              {me ? (
                <Link href="/wallet" onClick={() => setOpen(false)} className="btn-ghost flex-1">
                  {me.name || me.phone}
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost flex-1">Log in</Link>
                  <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary flex-1">Get started</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
