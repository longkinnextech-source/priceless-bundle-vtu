import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);

    const body = await readJson<{ amount?: number | string }>(req);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return fail("AMOUNT_MUST_BE_POSITIVE", "Enter an amount greater than zero.", 400);

    const bonus = await one<{ b: string }>("select fn_reinvest_commission($1,$2) as b", [user.id, amount]);
    return ok({ reinvested: amount, bonus_ghs: Number(bonus?.b ?? 0) });
  } catch (err) {
    return handleError(err);
  }
}
