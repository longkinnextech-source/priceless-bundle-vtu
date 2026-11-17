import { query } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    const tier = user?.tier ?? "customer";

    const rows = await query<{
      id: string; network: string; size_label: string; capacity_gb: string;
      retail_price_ghs: string; sub_agent_price_ghs: string; super_agent_price_ghs: string;
    }>(
      `select id, network, size_label, capacity_gb, retail_price_ghs, sub_agent_price_ghs, super_agent_price_ghs
         from plans where active = true order by network, sort_order`
    );

    const plans = rows.map((p) => ({
      id: p.id,
      network: p.network,
      size_label: p.size_label,
      capacity_gb: Number(p.capacity_gb),
      price_ghs: Number(
        tier === "super_agent" ? p.super_agent_price_ghs : tier === "sub_agent" ? p.sub_agent_price_ghs : p.retail_price_ghs
      ),
      retail_price_ghs: Number(p.retail_price_ghs),
    }));

    return ok({ plans, tier });
  } catch (err) {
    return handleError(err);
  }
}
