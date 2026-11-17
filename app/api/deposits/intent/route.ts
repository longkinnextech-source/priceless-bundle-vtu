import { ok, fail, handleError, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { generateReferenceCode } from "@/lib/reference";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail("UNAUTHENTICATED", "Please log in to top up.", 401);

    const body = await readJson<{ amount?: number | string }>(req);
    const amount = Number(body.amount);
    const settings = await getSettings();

    if (!Number.isFinite(amount) || amount <= 0) return fail("AMOUNT_MUST_BE_POSITIVE", "Enter the amount you are sending.", 400);
    if (amount < settings.min_deposit_ghs) return fail("AMOUNT_MUST_BE_POSITIVE", `Minimum top-up is GH₵${settings.min_deposit_ghs.toFixed(2)}.`, 400);

    const referenceCode = await generateReferenceCode();
    const intent = await one<{ id: string; reference_code: string; expected_amount_ghs: string; expires_at: string }>(
      `insert into deposit_intents (user_id, reference_code, expected_amount_ghs)
       values ($1,$2,$3)
       returning id, reference_code, expected_amount_ghs, expires_at`,
      [user.id, referenceCode, amount]
    );

    const collectionNumber = process.env.MOMO_COLLECTION_NUMBER || "059 882 3601";

    return ok({
      intent,
      collection_number: collectionNumber,
      instructions:
        `Send exactly GH₵${amount.toFixed(2)} to ${collectionNumber} and put the reference ${referenceCode} in the payment note. ` +
        `Your wallet is credited automatically as soon as the payment SMS arrives.`,
    });
  } catch (err) {
    return handleError(err);
  }
}
