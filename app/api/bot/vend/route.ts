import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { normalizePhone, isValidGhanaPhone } from "@/lib/money";
import { isValidNetwork, purchaseData } from "@/lib/datamart";

export const dynamic = "force-dynamic";

/**
 * POST — executes a purchase placed through a Super Agent's own bot.
 * The order is charged at the Super Agent's wholesale tier and counts toward
 * their squad volume via bot_orders.
 */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    if (user.tier !== "super_agent") return fail("INVALID_TIER", "Bot-in-a-box is a Super Agent feature.", 400);

    const body = await readJson<{ plan_id?: string; end_customer_phone?: string; channel?: string }>(req);
    const planId = String(body.plan_id || "");
    const phone = normalizePhone(body.end_customer_phone || "");
    const channel = body.channel === "whatsapp" ? "whatsapp" : "telegram";

    if (!isValidGhanaPhone(phone)) return fail("INVALID_RECIPIENT_PHONE", "Enter a valid customer phone number.", 400);

    const plan = await one<{ id: string; network: string; capacity_gb: string }>(
      "select id, network, capacity_gb from plans where id = $1 and active = true",
      [planId]
    );
    if (!plan) return fail("PLAN_NOT_AVAILABLE", "That bundle is no longer available.", 404);
    if (!isValidNetwork(plan.network)) return fail("PLAN_NOT_AVAILABLE", "Unknown network.", 400);

    const order = await one<{ id: string; price_charged_ghs: string }>(
      "select * from fn_create_order_and_debit($1,$2,$3)",
      [user.id, planId, phone]
    );
    if (!order) return fail("SERVER_ERROR", "Could not create the order.", 500);

    await one(
      "insert into bot_orders (order_id, super_agent_id, channel, end_customer_phone) values ($1,$2,$3,$4) returning id",
      [order.id, user.id, channel, phone]
    );

    const result = await purchaseData({
      orderId: order.id,
      phoneNumber: phone,
      network: plan.network,
      capacityGb: Number(plan.capacity_gb),
    });

    const final = await one<{ status: string; supplier_reference: string | null }>(
      "select * from fn_finalize_order($1,$2,$3,$4)",
      [order.id, result.success, result.orderReference ?? null, result.success ? null : result.message ?? "Supplier rejected the order"]
    );

    return ok({
      order: { id: order.id, status: final?.status ?? "processing", supplier_reference: final?.supplier_reference ?? null },
      simulated: result.simulated === true,
    });
  } catch (err) {
    return handleError(err);
  }
}
