import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { normalizePhone, isValidGhanaPhone } from "@/lib/money";
import { isValidNetwork, purchaseData, verifyMtnNumber } from "@/lib/datamart";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: string; network: string; capacity_gb: string; size_label: string;
  retail_price_ghs: string; sub_agent_price_ghs: string; super_agent_price_ghs: string;
};

/** GET — the signed-in buyer's own order history. */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    const orders = await query(
      `select o.id, o.recipient_phone, o.price_charged_ghs, o.status, o.supplier_reference,
              o.failure_reason, o.created_at, p.network, p.size_label
         from orders o join plans p on p.id = o.plan_id
        where o.buyer_id = $1 order by o.created_at desc limit 50`,
      [user.id]
    );
    return ok({ orders });
  } catch (err) {
    return handleError(err);
  }
}

/** POST — buy a bundle. Price is resolved server-side from the buyer's own tier. */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in to buy data.", 401);

    const body = await readJson<{ plan_id?: string; recipient_phone?: string }>(req);
    const planId = String(body.plan_id || "");
    const recipient = normalizePhone(body.recipient_phone || "");

    if (!planId) return fail("PLAN_NOT_AVAILABLE", "Choose a bundle.", 400);
    if (!isValidGhanaPhone(recipient)) return fail("INVALID_RECIPIENT_PHONE", "Enter a valid recipient phone number.", 400);

    const plan = await one<PlanRow>(
      `select id, network, capacity_gb, size_label, retail_price_ghs, sub_agent_price_ghs, super_agent_price_ghs
         from plans where id = $1 and active = true`,
      [planId]
    );
    if (!plan) return fail("PLAN_NOT_AVAILABLE", "That bundle is no longer available.", 404);
    if (!isValidNetwork(plan.network)) return fail("PLAN_NOT_AVAILABLE", "Unknown network for this bundle.", 400);

    // MTN guard: block numbers that cannot receive data yet (never charges anything).
    if (plan.network === "mtn") {
      const v = await verifyMtnNumber(recipient);
      if (!v.servable) {
        return fail("NUMBER_NOT_SERVABLE", v.message, 400);
      }
    }

    // Atomic: debit wallet + create order together, price resolved by the DB from the buyer's tier.
    const order = await one<{
      id: string; price_charged_ghs: string; status: string; buyer_tier_at_purchase: string;
    }>("select * from fn_create_order_and_debit($1,$2,$3)", [user.id, planId, recipient]);
    if (!order) return fail("SERVER_ERROR", "Could not create the order.", 500);

    // Hand off to the supplier. A rejection auto-refunds the buyer.
    const result = await purchaseData({
      orderId: order.id,
      phoneNumber: recipient,
      network: plan.network,
      capacityGb: Number(plan.capacity_gb),
    });

    const final = await one<{ status: string; supplier_reference: string | null; failure_reason: string | null }>(
      "select * from fn_finalize_order($1,$2,$3,$4)",
      [order.id, result.success, result.orderReference ?? null, result.success ? null : result.message ?? "Supplier rejected the order"]
    );

    return ok({
      order: {
        id: order.id,
        status: final?.status ?? order.status,
        supplier_reference: final?.supplier_reference ?? null,
        failure_reason: final?.failure_reason ?? null,
        price_charged_ghs: Number(order.price_charged_ghs),
      },
      simulated: result.simulated === true,
    });
  } catch (err) {
    return handleError(err);
  }
}
