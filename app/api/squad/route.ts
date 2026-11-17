import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    const overview = await one<{ squad: unknown; members: unknown }>(
      "select * from fn_squad_overview($1)",
      [user.id]
    );
    return ok({ overview: overview ?? { squad: null, members: [] } });
  } catch (err) {
    return handleError(err);
  }
}

/** POST — create/update your squad (super agents only) or set your volume target. */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);
    if (user.tier !== "super_agent") return fail("INVALID_TIER", "Only Super Agents can create a squad.", 400);

    const body = await readJson<{ name?: string; volume_target_ghs?: number | string }>(req);
    const target = Number(body.volume_target_ghs ?? 0);
    const squad = await one(
      "select * from fn_create_squad($1,$2,$3)",
      [user.id, body.name?.trim() || "My Squad", Number.isFinite(target) ? target : 0]
    );
    return ok({ squad });
  } catch (err) {
    return handleError(err);
  }
}
