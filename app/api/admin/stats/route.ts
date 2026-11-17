import { ok, fail, handleError } from "@/lib/api";
import { isAdminCookieValid } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isAdminCookieValid()) return fail("UNAUTHENTICATED", "Admin PIN required.", 401);
    const stats = await one<Record<string, unknown>>("select fn_admin_stats() as s");
    return ok({ stats: (stats as { s?: unknown })?.s ?? {} });
  } catch (err) {
    return handleError(err);
  }
}
