import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { WithdrawClient } from "@/components/withdraw-client";

export const metadata: Metadata = { title: "Withdraw" };
export const dynamic = "force-dynamic";
export default async function WithdrawPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const wallet = await one<{ balance_ghs: string }>(
    "select balance_ghs from wallets where user_id = $1",
    [user.id]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold tracking-tight text-ember-50 sm:text-3xl">Withdraw</h1>
        <p className="mt-1 text-sm text-ember-100/55">
          Cash out instantly, or wait for the free Friday batch.
        </p>
      </div>
      <WithdrawClient tier={user.tier} balance={wallet?.balance_ghs ?? "0"} />
    </div>
  );
}
