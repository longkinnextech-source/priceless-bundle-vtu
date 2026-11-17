export type ApiError = { code: string; message: string; status: number };

const SENTINELS: Record<string, ApiError> = {
  INSUFFICIENT_BALANCE: { code: "INSUFFICIENT_BALANCE", status: 400, message: "Insufficient wallet balance for this purchase." },
  INVALID_CREDENTIALS: { code: "INVALID_CREDENTIALS", status: 401, message: "Wrong phone number or PIN." },
  PHONE_ALREADY_REGISTERED: { code: "PHONE_ALREADY_REGISTERED", status: 409, message: "That phone number already has an account. Please log in instead." },
  USER_NOT_FOUND: { code: "USER_NOT_FOUND", status: 404, message: "Account not found." },
  RECIPIENT_NOT_FOUND: { code: "RECIPIENT_NOT_FOUND", status: 404, message: "Recipient account not found." },
  PLAN_NOT_AVAILABLE: { code: "PLAN_NOT_AVAILABLE", status: 404, message: "That bundle is no longer available." },
  ORDER_NOT_FOUND: { code: "ORDER_NOT_FOUND", status: 404, message: "Order not found." },
  SQUAD_NOT_FOUND: { code: "SQUAD_NOT_FOUND", status: 404, message: "Squad not found." },
  DEPOSIT_NOT_FOUND: { code: "DEPOSIT_NOT_FOUND", status: 404, message: "Deposit not found." },
  INVALID_PHONE: { code: "INVALID_PHONE", status: 400, message: "Enter a valid Ghana phone number (10 digits, starting with 0)." },
  INVALID_RECIPIENT_PHONE: { code: "INVALID_RECIPIENT_PHONE", status: 400, message: "Enter a valid recipient phone number (10 digits, starting with 0)." },
  INVALID_TIER: { code: "INVALID_TIER", status: 400, message: "That account tier is not allowed." },
  INVALID_MODE: { code: "INVALID_MODE", status: 400, message: "Choose a valid withdrawal mode." },
  AMOUNT_MUST_BE_POSITIVE: { code: "AMOUNT_MUST_BE_POSITIVE", status: 400, message: "Amount must be greater than zero." },
  BELOW_MIN_WITHDRAWAL: { code: "BELOW_MIN_WITHDRAWAL", status: 400, message: "That is below the minimum withdrawal amount." },
  FEE_EXCEEDS_AMOUNT: { code: "FEE_EXCEEDS_AMOUNT", status: 400, message: "The withdrawal fee is larger than the amount." },
  CANNOT_SEND_TO_SELF: { code: "CANNOT_SEND_TO_SELF", status: 400, message: "You cannot send money to yourself." },
  PIN_TOO_SHORT: { code: "PIN_TOO_SHORT", status: 400, message: "Your PIN must be at least 4 digits." },
  COMMITMENT_NOT_MET: { code: "COMMITMENT_NOT_MET", status: 400, message: "Top up your wallet to the Super Agent commitment before upgrading." },
  NUMBER_NOT_SERVABLE: { code: "NUMBER_NOT_SERVABLE", status: 400, message: "This MTN number cannot receive data yet." },
};

export function mapError(err: unknown): ApiError {
  const msg = String((err as { message?: string })?.message ?? "");
  for (const key of Object.keys(SENTINELS)) {
    if (msg.includes(key)) return SENTINELS[key];
  }
  if (msg.includes("append-only")) {
    return { code: "LEDGER_IMMUTABLE", status: 400, message: "Ledger entries cannot be changed." };
  }
  if (msg.includes("DATABASE_URL is not configured")) {
    return { code: "DB_NOT_CONFIGURED", status: 503, message: "The database is not configured yet. Please finish setup." };
  }
  console.error("[api error]", msg || err);
  return { code: "SERVER_ERROR", status: 500, message: "Something went wrong. Please try again." };
}
