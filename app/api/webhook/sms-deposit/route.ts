import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { parseDepositSms } from "@/lib/sms";
import { mapError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Receives forwarded Mobile Money deposit SMS from an Android SMS-forwarder app.
 * Protected by the shared secret header X-Webhook-Secret.
 * Always logs the raw payload first and never throws on a bad payload.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-webhook-secret") || "";
  const expected = process.env.SMS_WEBHOOK_SECRET || "";

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    raw = "";
  }

  console.log("[sms-deposit] raw payload:", raw.slice(0, 2000));

  if (!expected) {
    return NextResponse.json({ ok: false, error: { code: "NOT_CONFIGURED", message: "SMS_WEBHOOK_SECRET is not configured." } }, { status: 503 });
  }
  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "Invalid webhook secret." } }, { status: 403 });
  }

  try {
    // Accept either {"text": "..."} JSON or a plain-text body.
    let text = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        text = String(parsed.text ?? parsed.message ?? parsed.body ?? parsed.sms ?? raw);
      }
    } catch {
      /* plain text body — use as-is */
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: { code: "EMPTY_PAYLOAD", message: "No SMS text received." } }, { status: 400 });
    }

    const parsedSms = parseDepositSms(text);

    if (parsedSms.amount == null) {
      const row = await one<{ id: string; status: string }>(
        `insert into deposits (amount_ghs, reference_code, sender_phone, raw_sms, status)
         values (0.01, $1, $2, $3, 'unmatched_review') returning id, status`,
        [parsedSms.referenceCode, parsedSms.senderPhone, text.slice(0, 4000)]
      );
      return NextResponse.json({ ok: true, data: { status: row?.status ?? "unmatched_review", reason: "no_amount_found" } });
    }

    const deposit = await one<{ id: string; status: string }>(
      `insert into deposits (amount_ghs, reference_code, sender_phone, raw_sms, status)
       values ($1,$2,$3,$4,'pending_match') returning id, status`,
      [parsedSms.amount, parsedSms.referenceCode, parsedSms.senderPhone, text.slice(0, 4000)]
    );
    if (!deposit) {
      return NextResponse.json({ ok: false, error: { code: "SERVER_ERROR", message: "Could not store the deposit." } }, { status: 500 });
    }

    const processed = await one<{ status: string; user_id: string | null; amount_ghs: string }>(
      "select * from fn_process_deposit($1)",
      [deposit.id]
    );

    return NextResponse.json({
      ok: true,
      data: {
        deposit_id: deposit.id,
        status: processed?.status ?? "pending_match",
        amount_ghs: Number(processed?.amount_ghs ?? parsedSms.amount),
        matched: processed?.status === "credited",
      },
    });
  } catch (err) {
    const e = mapError(err);
    console.error("[sms-deposit] processing failed:", e.message);
    return NextResponse.json({ ok: false, error: e }, { status: e.status });
  }
}
