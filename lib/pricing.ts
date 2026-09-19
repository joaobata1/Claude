import { sql, ensureSchema, getSetting } from "./db";

export interface FeeConfig {
  id: string;
  name: string;
  value: number;
  type: "fixed" | "percent";
}

export interface FeeLine extends FeeConfig {
  amount: number;
}

export interface PriceBreakdown {
  nights: number;
  nightsSubtotal: number;
  fees: FeeLine[];
  total: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function eachDate(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const d = new Date(checkin);
  const end = new Date(checkout);
  while (d < end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export async function getFeesConfig(): Promise<FeeConfig[]> {
  const raw = await getSetting("fees_config");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Preço total de uma estadia: soma o preço de cada noite (preço próprio do dia, se
 * definido no calendário, senão o preço por omissão) + as taxas configuradas no
 * backoffice (fixas em € ou em % sobre o valor das noites).
 */
export async function calculateBookingPrice(checkin: string, checkout: string): Promise<PriceBreakdown> {
  await ensureSchema();
  const nights = eachDate(checkin, checkout);
  const defaultPrice = parseFloat((await getSetting("price_per_night")) ?? "0") || 0;

  const rows =
    nights.length > 0
      ? await sql<{ date: string; price: number }[]>`
          SELECT date, price FROM daily_prices WHERE channel = 'site' AND date IN ${sql(nights)}
        `
      : [];
  const priceByDate = new Map(rows.map((r) => [r.date, r.price]));

  const nightsSubtotal = round2(nights.reduce((sum, d) => sum + (priceByDate.get(d) ?? defaultPrice), 0));

  const feesConfig = await getFeesConfig();
  const fees: FeeLine[] = feesConfig.map((f) => ({
    ...f,
    amount: f.type === "percent" ? round2((nightsSubtotal * f.value) / 100) : round2(f.value),
  }));

  const total = round2(nightsSubtotal + fees.reduce((sum, f) => sum + f.amount, 0));

  return { nights: nights.length, nightsSubtotal, fees, total };
}
