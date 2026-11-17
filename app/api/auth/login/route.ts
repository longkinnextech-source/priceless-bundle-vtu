import { one } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { normalizePhone } from "@/lib/money";
import { setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ phone?: string; pin?: string }>(req);
    const phone = normalizePhone(body.phone || "");
    const pin = String(body.pin || "");
    if (!phone || !pin) return fail("INVALID_CREDENTIALS", "Enter your phone number and PIN.", 401);

    const user = await one<{ id: string; phone: string; name: string | null; tier: string; is_admin: boolean }>(
      "select id, phone, name, tier, is_admin from fn_login($1,$2)",
      [phone, pin]
    );
    if (!user) return fail("INVALID_CREDENTIALS", "Wrong phone number or PIN.", 401);

    setSessionCookie(user.id);
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
