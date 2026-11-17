export function gh(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return "GH₵" + (Number.isFinite(v) ? v : 0).toFixed(2);
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export const NETWORKS = ["mtn", "telecel", "airteltigo"] as const;
export type Network = (typeof NETWORKS)[number];

export const NETWORK_LABEL: Record<Network, string> = {
  mtn: "MTN",
  telecel: "Telecel",
  airteltigo: "AirtelTigo",
};

/** Real telecom brand colours — used ONLY on network badges. */
export const NETWORK_BRAND: Record<Network, { bg: string; text: string }> = {
  mtn: { bg: "#FFCC00", text: "#1a1a1a" },
  telecel: { bg: "#E60000", text: "#ffffff" },
  airteltigo: { bg: "#0033A0", text: "#ffffff" },
};

export const TIER_LABEL: Record<string, string> = {
  customer: "Customer",
  sub_agent: "Sub-Agent",
  super_agent: "Super Agent",
};

export function normalizePhone(input: string): string {
  const digits = String(input || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("233") && digits.length === 12) return "0" + digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) return digits;
  if (digits.length === 9) return "0" + digits;
  return digits;
}

export function isValidGhanaPhone(input: string): boolean {
  return /^0[0-9]{9}$/.test(normalizePhone(input));
}
