import { sql, ensureSchema, getSetting } from "./db";
import { getRatePlanForCheckin, RatePlan } from "./rate-plans";
import { addDaysISO } from "./dates";

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
  discountPercent: number | null; // desconto semanal/mensal aplicado, se algum
  discountAmount: number;
  total: number;
  ratePlanName: string;
  minNights: number | null;
  maxNights: number | null;
  cancellationDays: number | null;
}

/** Nights >= 28 conta como estadia mensal, >= 7 como semanal — a mais vantajosa das duas prevalece. */
function applicableDiscountPercent(nights: number, plan: RatePlan): number | null {
  if (nights >= 28 && plan.monthlyDiscountPercent) return plan.monthlyDiscountPercent;
  if (nights >= 7 && plan.weeklyDiscountPercent) return plan.weeklyDiscountPercent;
  return null;
}

export function checkNightsAgainstPlan(nights: number, plan: RatePlan): string | null {
  if (plan.minNights && nights < plan.minNights) return `min:${plan.minNights}`;
  if (plan.maxNights && nights > plan.maxNights) return `max:${plan.maxNights}`;
  return null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function eachDate(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  let d = checkin;
  while (d < checkout) {
    dates.push(d);
    d = addDaysISO(d, 1);
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

  const grossNightsSubtotal = round2(nights.reduce((sum, d) => sum + (priceByDate.get(d) ?? defaultPrice), 0));

  const ratePlan = await getRatePlanForCheckin(checkin);
  const discountPercent = applicableDiscountPercent(nights.length, ratePlan);
  const discountAmount = discountPercent ? round2((grossNightsSubtotal * discountPercent) / 100) : 0;
  const nightsSubtotal = round2(grossNightsSubtotal - discountAmount);

  const feesConfig = await getFeesConfig();
  const fees: FeeLine[] = feesConfig.map((f) => ({
    ...f,
    amount: f.type === "percent" ? round2((nightsSubtotal * f.value) / 100) : round2(f.value),
  }));

  const total = round2(nightsSubtotal + fees.reduce((sum, f) => sum + f.amount, 0));

  return {
    nights: nights.length,
    nightsSubtotal,
    fees,
    discountPercent,
    discountAmount,
    total,
    ratePlanName: ratePlan.name,
    minNights: ratePlan.minNights,
    maxNights: ratePlan.maxNights,
    cancellationDays: ratePlan.cancellationDays,
  };
}
