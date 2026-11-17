import { ok, fail, handleError, readJson } from "@/lib/api";
import { isAdminCookieValid } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { normalizePhone } from "@/lib/money";

export const dynamic = "force-dynamic";

/** GET — the unmatched-deposit review queue (plus recently credited deposits). */
export async function GET() {
  try {
    if (!isAdminCookieValid()) return fail("UNAUTHENTICATED", "Admin PIN required.", 401);
    const unmatched = await query(
      `select id, amount_ghs, reference_code, sender_phone, raw_sms, status, created_at
         from deposits where status = 'unmatched_review' order by created_at desc limit 100`
    );
    const recent = await query(
      `select d.id, d.amount_ghs, d.reference_code, d.sender_phone, d.status, d.created_at, u.phone as user_phone
         from deposits d left join users u on u.id = d.user_id
        order by d.created_at desc limit 50`
    );
    return ok({ unmatched, recent });
  } catch (err) {
    return handleError(err);
  }
}

/** POST — resolve an unmatched deposit by crediting a specific user. */
export async function POST(req: Request) {
  try {
    if (!isAdminCookieValid()) return fail("UNAUTHENTICATED", "Admin PIN required.", 401);
    const b = await readJson<{ deposit_id?: string; user_phone?: string }>(req);
    if (!b.deposit_id) return fail("DEPOSIT_NOT_FOUND", "Missing deposit id.", 400);
    const phone = normalizePhone(b.user_phone || "");
    const user = await one<{ id: string }>("select id from users where phone = $1", [phone]);
    if (!user) return fail("USER_NOT_FOUND", "No account uses that phone number.", 404);

    const deposit = await one("select * from fn_admin_resolve_deposit($1,$2)", [b.deposit_id, user.id]);
    return ok({ deposit });
  } catch (err) {
    return handleError(err);
  }
}
