import { ok } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  const wallet = await one<{ balance_ghs: string; commission_balance_ghs: string }>(
    "select balance_ghs, commission_balance_ghs from wallets where user_id = $1",
    [user.id]
  );
  return ok({ user, wallet });
}
