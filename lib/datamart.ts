import { NETWORKS, type Network } from "./money";

const BASE_URL = process.env.DATAMART_BASE_URL || "https://api.datamartgh.shop/api";
const API_KEY = process.env.DATAMART_API_KEY || "";

export function isLiveProvider(): boolean {
  return API_KEY.trim().length > 0;
}

/** Our internal network values -> DataMartGH's codes. */
const NETWORK_CODE: Record<Network, string> = {
  mtn: "YELLO",
  telecel: "TELECEL",
  airteltigo: "AT_PREMIUM",
};

export type PurchaseResult = {
  success: boolean;
  orderReference?: string;
  message?: string;
  simulated?: boolean;
};

export type VerifyResult = {
  servable: boolean;
  recommendation: "sell_any" | "activate_first";
  message: string;
  simulated?: boolean;
};

async function fetchWithTimeout(url: string, init: RequestInit, ms = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Places a data purchase with DataMartGH.
 * Falls back to a ~95% simulated success when no API key is configured,
 * so the whole app works end-to-end before a live key is added.
 */
export async function purchaseData(params: {
  orderId: string;
  phoneNumber: string;
  network: Network;
  capacityGb: number;
}): Promise<PurchaseResult> {
  const { orderId, phoneNumber, network, capacityGb } = params;

  if (!isLiveProvider()) {
    // Simulated success rate. Defaults to 95%; set MOCK_SUCCESS_RATE=1 for
    // deterministic runs (tests, demos) and 0 to exercise the refund path.
    const raw = Number(process.env.MOCK_SUCCESS_RATE);
    const rate = Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.95;
    const success = Math.random() < rate;
    return success
      ? { success: true, orderReference: `MOCK-${orderId.slice(0, 8).toUpperCase()}`, simulated: true }
      : { success: false, message: "Simulated supplier failure (no API key configured).", simulated: true };
  }

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "X-Idempotency-Key": orderId,
      },
      body: JSON.stringify({
        phoneNumber,
        network: NETWORK_CODE[network],
        capacity: String(capacityGb),
        gateway: "wallet",
      }),
    });

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    const ref = body?.data?.orderReference ?? body?.orderReference ?? null;
    if (res.ok && ref) {
      return { success: true, orderReference: String(ref) };
    }
    return {
      success: false,
      message: body?.message || body?.error || `Supplier returned HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "Supplier timed out" : "Could not reach the supplier";
    return { success: false, message };
  }
}

/**
 * MTN pre-purchase number verification. Never charges anything.
 * Without a live key, defaults to servable so the flow stays usable.
 */
export async function verifyMtnNumber(phoneNumber: string): Promise<VerifyResult> {
  if (!isLiveProvider()) {
    return {
      servable: true,
      recommendation: "sell_any",
      message: "Number check skipped (no live supplier key configured).",
      simulated: true,
    };
  }
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/developer/verify-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body: JSON.stringify({ phoneNumber }),
    });
    const body: any = await res.json().catch(() => null);
    const d = body?.data ?? {};
    return {
      servable: d.servable !== false,
      recommendation: d.recommendation === "activate_first" ? "activate_first" : "sell_any",
      message: d.message || (d.servable === false
        ? "This MTN number is under a new-beneficiary freeze. Sell a 1GB bundle first and allow up to 72 hours for activation."
        : "Number can receive data."),
    };
  } catch {
    // Never block a sale because the checker is unreachable
    return { servable: true, recommendation: "sell_any", message: "Number check unavailable right now.", simulated: true };
  }
}

export function isValidNetwork(n: string): n is Network {
  return (NETWORKS as readonly string[]).includes(n);
}
