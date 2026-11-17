import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { normalizePhone } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in.", 401);

    const body = await readJson<{ recipient_phone?: string; amount?: number | string }>(req);
    const amount = Number(body.amount);
    const phone = normalizePhone(body.recipient_phone || "");

    if (!Number.isFinite(amount) || amount <= 0) return fail("AMOUNT_MUST_BE_POSITIVE", "Enter an amount greater than zero.", 400);

    const recipient = await one<{ id: string }>(
      "select id from users where phone = $1 and is_active = true",
      [phone]
    );
    if (!recipient) return fail("RECIPIENT_NOT_FOUND", "No Priceless Bundle account uses that number.", 404);
    if (recipient.id === user.id) return fail("CANNOT_SEND_TO_SELF", "You cannot send money to yourself.", 400);

    await one("select fn_p2p_transfer($1,$2,$3)", [user.id, recipient.id, amount]);
    return ok({ sent: true, amount });
  } catch (err) {
    return handleError(err);
  }
}
