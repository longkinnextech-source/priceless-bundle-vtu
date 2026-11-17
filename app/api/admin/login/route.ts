import { ok, fail, handleError, readJson } from "@/lib/api";
import { setAdminCookie, clearAdminCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST — unlock the admin panel with the shared admin PIN. */
export async function POST(req: Request) {
  try {
    const body = await readJson<{ pin?: string }>(req);
    const expected = process.env.ADMIN_PIN || "";
    if (!expected) return fail("SERVER_ERROR", "ADMIN_PIN is not configured on the server.", 503);
    if (String(body.pin || "") !== expected) return fail("INVALID_CREDENTIALS", "Wrong admin PIN.", 401);
    setAdminCookie();
    return ok({ unlocked: true });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE — lock the admin panel again. */
export async function DELETE() {
  clearAdminCookie();
  return ok({ locked: true });
}
