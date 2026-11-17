import { ok, fail, handleError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);

    const wallet = await one<{ balance_ghs: string; commission_balance_ghs: string }>(
      "select balance_ghs, commission_balance_ghs from wallets where user_id = $1",
      [user.id]
    );

    const ledger = await query(
      `select id, type, bucket, amount_ghs, balance_after, reference, created_at
         from wallet_ledger where user_id = $1 order by created_at desc limit 100`,
      [user.id]
    );

    const pendingIntents = await query(
      `select id, reference_code, expected_amount_ghs, status, expires_at, created_at
         from deposit_intents where user_id = $1 and status = 'pending_match'
        order by created_at desc limit 10`,
      [user.id]
    );

    return ok({ wallet, ledger, pending_intents: pendingIntents });
  } catch (err) {
    return handleError(err);
  }
}
