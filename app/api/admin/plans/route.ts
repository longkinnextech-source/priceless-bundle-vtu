import { ok, fail, handleError, readJson } from "@/lib/api";
import { isAdminCookieValid } from "@/lib/auth";
import { one, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isAdminCookieValid()) return fail("UNAUTHENTICATED", "Admin PIN required.", 401);
    const plans = await query(
      `select id, network, size_label, capacity_gb, cost_price_ghs, retail_price_ghs,
              sub_agent_price_ghs, super_agent_price_ghs, active, sort_order
         from plans order by network, sort_order`
    );
    return ok({ plans });
  } catch (err) {
    return handleError(err);
  }
}

/** PATCH — edit one plan's pricing / active flag. */
export async function PATCH(req: Request) {
  try {
    if (!isAdminCookieValid()) return fail("UNAUTHENTICATED", "Admin PIN required.", 401);
    const b = await readJson<{
      id?: string; cost_price_ghs?: number | string; retail_price_ghs?: number | string;
      sub_agent_price_ghs?: number | string; super_agent_price_ghs?: number | string; active?: boolean;
    }>(req);
    if (!b.id) return fail("PLAN_NOT_AVAILABLE", "Missing plan id.", 400);

    const updated = await one(
      `update plans set
         cost_price_ghs        = coalesce($2, cost_price_ghs),
         retail_price_ghs      = coalesce($3, retail_price_ghs),
         sub_agent_price_ghs   = coalesce($4, sub_agent_price_ghs),
         super_agent_price_ghs = coalesce($5, super_agent_price_ghs),
         active                = coalesce($6, active)
       where id = $1
       returning id, network, size_label, retail_price_ghs, active`,
      [
        b.id,
        b.cost_price_ghs != null ? Number(b.cost_price_ghs) : null,
        b.retail_price_ghs != null ? Number(b.retail_price_ghs) : null,
        b.sub_agent_price_ghs != null ? Number(b.sub_agent_price_ghs) : null,
        b.super_agent_price_ghs != null ? Number(b.super_agent_price_ghs) : null,
        typeof b.active === "boolean" ? b.active : null,
      ]
    );
    return ok({ plan: updated });
  } catch (err) {
    return handleError(err);
  }
}
