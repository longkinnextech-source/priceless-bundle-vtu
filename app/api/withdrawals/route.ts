import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    const withdrawals = await query(
      "select id, amount_ghs, fee_ghs, net_ghs, mode, status, created_at from withdrawals where user_id = $1 order by created_at desc limit 50",
      [user.id]
    );
    return ok({ withdrawals });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);

    const body = await readJson<{ amount?: number | string; mode?: string }>(req);
    const amount = Number(body.amount);
    const mode = body.mode === "free_friday_batch" ? "free_friday_batch" : "instant";
    if (!Number.isFinite(amount) || amount <= 0) return fail("AMOUNT_MUST_BE_POSITIVE", "Enter an amount greater than zero.", 400);

    const w = await one<{ id: string; amount_ghs: string; fee_ghs: string; net_ghs: string; mode: string; status: string }>(
      "select * from fn_request_withdrawal($1,$2,$3)",
      [user.id, amount, mode]
    );
    return ok({ withdrawal: w });
  } catch (err) {
    return handleError(err);
  }
}
