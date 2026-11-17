import { ok, fail, handleError, readJson } from "@/lib/api";
import { normalizePhone, isValidGhanaPhone } from "@/lib/money";
import { verifyMtnNumber } from "@/lib/datamart";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ phone?: string }>(req);
    const phone = normalizePhone(body.phone || "");
    if (!isValidGhanaPhone(phone)) return fail("INVALID_RECIPIENT_PHONE", "Enter a valid MTN number to check.", 400);

    const result = await verifyMtnNumber(phone);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
