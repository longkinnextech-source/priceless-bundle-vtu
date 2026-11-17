import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { WalletClient } from "@/components/wallet-client";

export const metadata: Metadata = { title: "Wallet" };
export const dynamic = "force-dynamic";
export default async function WalletPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">Wallet</h1>
        <p className="mt-1 text-sm text-ember-100/55">
          Top up, track every movement, and keep your balance ready for instant purchases.
        </p>
      </div>
      <WalletClient tier={user.tier} />
    </div>
  );
}
