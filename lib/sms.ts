export type ParsedDepositSms = {
  amount: number | null;
  senderPhone: string | null;
  referenceCode: string | null;
};

function normalizePhone(input: string): string {
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.startsWith("233") && digits.length === 12) return "0" + digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) return digits;
  if (digits.length === 9) return "0" + digits;
  return digits;
}

/**
 * Defensively parses a forwarded Mobile Money deposit SMS.
 * Never throws — returns nulls when a field cannot be found.
 * Handles MTN MoMo, Telecel Cash and AirtelTigo Money phrasings.
 */
export function parseDepositSms(raw: string): ParsedDepositSms {
  const out: ParsedDepositSms = { amount: null, senderPhone: null, referenceCode: null };
  try {
    const text = String(raw || "").replace(/\u00a0/g, " ");

    // Amount: GHS / GH₵ / GHC / GH¢ / GHS20.00 / 20.00 GHS
    const amountPatterns = [
      /(?:GHS|GH₵|GHC|GH¢)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:GHS|GH₵|GHC|GH¢)/i,
    ];
    for (const re of amountPatterns) {
      const m = text.match(re);
      if (m) {
        const n = Number(m[1].replace(/,/g, ""));
        if (Number.isFinite(n) && n > 0) {
          out.amount = n;
          break;
        }
      }
    }

    // Reference code: our own PB-XXXX format
    const ref = text.match(/\bPB[-\s]?([A-Z0-9]{4,8})\b/i);
    if (ref) out.referenceCode = `PB-${ref[1].toUpperCase()}`;

    // Sender phone: prefer text following "from"
    const from = text.match(/from\s*:?\s*(\+?233\d{9}|0\d{9})/i);
    if (from) {
      out.senderPhone = normalizePhone(from[1]);
    } else {
      const anyPhone = text.match(/(\+?233\d{9}|0\d{9})/);
      if (anyPhone) out.senderPhone = normalizePhone(anyPhone[1]);
    }
  } catch (err) {
    console.error("[sms parse] failed, returning empty parse", err);
  }
  return out;
}
