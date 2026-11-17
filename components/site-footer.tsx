import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-coal-700/70 bg-coal-900/60">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <Logo size={30} />
              <span className="text-sm font-extrabold tracking-tight text-ember-50">Priceless Bundle</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ember-100/55">
              Data bundles at agent prices, delivered instantly across Ghana. MTN, Telecel and AirtelTigo —
              one wallet, one price list, no overcharging.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ember-200/50">Product</p>
              <ul className="space-y-1.5 text-ember-100/65">
                <li><Link href="/buy" className="hover:text-ember-300">Buy Data</Link></li>
                <li><Link href="/wallet" className="hover:text-ember-300">Wallet</Link></li>
                <li><Link href="/agent" className="hover:text-ember-300">Agent Programme</Link></li>
                <li><Link href="/withdraw" className="hover:text-ember-300">Withdrawals</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ember-200/50">Account</p>
              <ul className="space-y-1.5 text-ember-100/65">
                <li><Link href="/signup" className="hover:text-ember-300">Create account</Link></li>
                <li><Link href="/login" className="hover:text-ember-300">Log in</Link></li>
                <li><Link href="/admin" className="hover:text-ember-300">Admin</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-coal-700/60 pt-6 text-xs text-ember-100/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Priceless Bundle by LongKinnex Tech and Data</p>
          <p>Prices in Ghana Cedis (GH₵). Bundles are non-refundable once delivered.</p>
        </div>
      </div>
    </footer>
  );
}
