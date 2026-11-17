import { ok, fail, handleError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET — the Super Agent upgrade requirements and the caller's progress. */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    const settings = await getSettings();
    const wallet = await one<{ balance_ghs: string }>("select balance_ghs from wallets where user_id = $1", [user.id]);
    const balance = Number(wallet?.balance_ghs ?? 0);
    return ok({
      tier: user.tier,
      commitment_ghs: settings.super_agent_commitment_ghs,
      balance_ghs: balance,
      eligible: user.tier === "super_agent" || balance >= settings.super_agent_commitment_ghs,
    });
  } catch (err) {
    return handleError(err);
  }
}

/** POST — upgrade to Super Agent once the wallet commitment is met. */
export async function POST() {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    const updated = await one<{ tier: string }>("select * from fn_upgrade_to_super_agent($1)", [user.id]);
    return ok({ tier: updated?.tier ?? "super_agent" });
  } catch (err) {
    return handleError(err);
  }
}
