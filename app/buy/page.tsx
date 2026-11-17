import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { BuyClient } from "@/components/buy-client";

export const metadata: Metadata = { title: "Buy Data" };
export const dynamic = "force-dynamic";

export default async function BuyPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">Buy Data</h1>
        <p className="mt-1 text-sm text-ember-100/55">
          Pick a network and bundle. Your price is set by your account tier.
        </p>
      </div>
      <BuyClient initialTier={user.tier} />
    </div>
  );
}
