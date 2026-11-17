import { ok, fail, handleError, readJson } from "@/lib/api";
import { isAdminCookieValid } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!isAdminCookieValid()) return fail("UNAUTHENTICATED", "Admin PIN required.", 401);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const params: unknown[] = [];
    let where = "";
    if (status && ["pending", "processing", "delivered", "failed", "refunded"].includes(status)) {
      params.push(status);
      where = "where o.status = $1";
    }
    const orders = await query(
      `select o.id, o.recipient_phone, o.price_charged_ghs, o.buyer_tier_at_purchase, o.status,
              o.supplier_reference, o.failure_reason, o.created_at,
              p.network, p.size_label, u.phone as buyer_phone, u.name as buyer_name
         from orders o
         join plans p on p.id = o.plan_id
         join users u on u.id = o.buyer_id
         ${where}
        order by o.created_at desc limit 200`,
      params
    );
    return ok({ orders });
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH — manually finalise a stuck order (deliver or refund). */
export async function PATCH(req: Request) {
  try {
    if (!isAdminCookieValid()) return fail("UNAUTHENTICATED", "Admin PIN required.", 401);
    const b = await readJson<{ id?: string; success?: boolean; failure_reason?: string; supplier_reference?: string }>(req);
    if (!b.id) return fail("ORDER_NOT_FOUND", "Missing order id.", 400);
    const { one } = await import("@/lib/db");
    const order = await one(
      "select * from fn_finalize_order($1,$2,$3,$4)",
      [b.id, b.success !== false, b.supplier_reference ?? null, b.failure_reason ?? null]
    );
    return ok({ order });
  } catch (err) {
    return handleError(err);
  }
}
