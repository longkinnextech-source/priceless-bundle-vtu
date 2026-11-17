import { query } from "./db";

export type Settings = Record<string, number>;

let cache: { at: number; data: Settings } | null = null;

const DEFAULTS: Settings = {
  commission_rate_percent: 3,
  reinvest_bonus_customer: 2,
  reinvest_bonus_sub_agent: 3.5,
  reinvest_bonus_super_agent: 5,
  withdrawal_fee_percent: 1.5,
  withdrawal_fee_min_ghs: 0.5,
  super_agent_commitment_ghs: 500,
  deposit_match_window_minutes: 30,
  min_withdrawal_ghs: 5,
  min_deposit_ghs: 1,
};

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.data;
  try {
    const rows = await query<{ key: string; value: string }>("select key, value from app_settings");
    const data: Settings = { ...DEFAULTS };
    for (const r of rows) {
      const n = Number(r.value);
      if (Number.isFinite(n)) data[r.key] = n;
    }
    cache = { at: Date.now(), data };
    return data;
  } catch {
    return { ...DEFAULTS };
  }
}
