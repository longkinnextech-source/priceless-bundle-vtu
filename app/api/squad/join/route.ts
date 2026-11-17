import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST — join a Super Agent's squad via their recruit link (ref = super agent's user id). */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in or sign up first.", 401);

    const body = await readJson<{ ref?: string }>(req);
    const ref = String(body.ref || "").trim();
    if (!ref) return fail("USER_NOT_FOUND", "That recruit link is missing its code.", 400);

    const updated = await one<{ id: string; tier: string; squad_id: string | null }>(
      "select id, tier, squad_id from fn_join_squad($1,$2)",
      [user.id, ref]
    );
    return ok({ joined: true, tier: updated?.tier ?? user.tier });
  } catch (err) {
    return handleError(err);
  }
}
