import { one } from "@/lib/db";
import { ok, fail, handleError, readJson } from "@/lib/api";
import { normalizePhone, isValidGhanaPhone } from "@/lib/money";
import { setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ phone?: string; name?: string; pin?: string; tier?: string }>(req);
    const phone = normalizePhone(body.phone || "");
    const pin = String(body.pin || "");
    const tier = body.tier === "sub_agent" ? "sub_agent" : "customer";

    if (!isValidGhanaPhone(phone)) return fail("INVALID_PHONE", "Enter a valid Ghana phone number (10 digits, starting with 0).", 400);
    if (pin.length < 4) return fail("PIN_TOO_SHORT", "Your PIN must be at least 4 digits.", 400);

    const user = await one<{ id: string; phone: string; name: string | null; tier: string }>(
      "select id, phone, name, tier from fn_register_user_with_pin($1,$2,$3,$4)",
      [phone, body.name?.trim() || null, pin, tier]
    );
    if (!user) return fail("SERVER_ERROR", "Could not create the account.", 500);

    setSessionCookie(user.id);
    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
