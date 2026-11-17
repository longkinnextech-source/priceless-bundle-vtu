import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET — the caller's bot configuration + recent bot orders. */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    const row = await one<{ telegram_bot_token: string | null; whatsapp_business_endpoint: string | null }>(
      "select telegram_bot_token, whatsapp_business_endpoint from users where id = $1",
      [user.id]
    );
    const botOrders = await query(
      `select b.id, b.channel, b.end_customer_phone, b.created_at, o.status, p.size_label, p.network
         from bot_orders b join orders o on o.id = b.order_id join plans p on p.id = o.plan_id
        where b.super_agent_id = $1 order by b.created_at desc limit 25`,
      [user.id]
    );
    const tokenSet = !!row?.telegram_bot_token;
    return ok({
      telegram_connected: tokenSet,
      telegram_bot_token_masked: tokenSet ? "••••" + String(row?.telegram_bot_token).slice(-4) : null,
      whatsapp_business_endpoint: row?.whatsapp_business_endpoint ?? null,
      bot_orders: botOrders,
    });
  } catch (err) {
    return handleError(err);
  }
}

/** POST — save the caller's own Telegram bot token / WhatsApp endpoint (Super Agents only). */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    if (user.tier !== "super_agent") return fail("INVALID_TIER", "Bot-in-a-box is a Super Agent feature.", 400);

    const body = await readJson<{ telegram_bot_token?: string; whatsapp_business_endpoint?: string }>(req);
    const token = String(body.telegram_bot_token || "").trim();
    const wa = String(body.whatsapp_business_endpoint || "").trim();

    if (token && !/^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token)) {
      return fail("INVALID_TIER", "That does not look like a Telegram bot token from @BotFather.", 400);
    }
    if (wa && !/^https:\/\//i.test(wa)) {
      return fail("INVALID_TIER", "The WhatsApp endpoint must be an https:// URL.", 400);
    }

    await one(
      "update users set telegram_bot_token = nullif($2,''), whatsapp_business_endpoint = nullif($3,'') where id = $1 returning id",
      [user.id, token, wa]
    );
    return ok({ saved: true });
  } catch (err) {
    return handleError(err);
  }
}
