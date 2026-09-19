import { sql, ensureSchema, getSetting } from "./db";

export interface RatePlan {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
  cancellationDays: number | null; // null = sem cancelamento grátis
  minNights: number | null; // null = sem mínimo
  maxNights: number | null; // null = sem máximo
  weeklyDiscountPercent: number | null; // null = desligado
  monthlyDiscountPercent: number | null; // null = desligado
}

export const DEFAULT_RATE_PLAN: RatePlan = {
  id: "normal",
  name: "Normal",
  color: "#6366f1",
  isDefault: true,
  cancellationDays: null,
  minNights: null,
  maxNights: null,
  weeklyDiscountPercent: null,
  monthlyDiscountPercent: null,
};

export async function getRatePlans(): Promise<RatePlan[]> {
  const raw = await getSetting("rate_plans");
  if (!raw) return [DEFAULT_RATE_PLAN];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [DEFAULT_RATE_PLAN];
  } catch {
    return [DEFAULT_RATE_PLAN];
  }
}

/** Mapa data → id da tarifa, apenas para os dias com uma tarifa não-normal atribuída (dentro do intervalo). */
export async function getDateRatePlanMap(start: string, end: string): Promise<Map<string, string>> {
  await ensureSchema();
  const rows = await sql<{ date: string; rate_plan_id: string }[]>`
    SELECT date, rate_plan_id FROM date_rate_plans WHERE date >= ${start} AND date <= ${end}
  `;
  return new Map(rows.map((r) => [r.date, r.rate_plan_id]));
}

/**
 * A tarifa que governa uma estadia é a atribuída à data de check-in (ou a "Normal" por
 * omissão) — política de cancelamento, mínimo/máximo de noites e descontos aplicam-se
 * à reserva inteira a partir dessa data, mesmo que noites seguintes tenham preços próprios.
 */
export async function getRatePlanForCheckin(checkin: string): Promise<RatePlan> {
  await ensureSchema();
  const plans = await getRatePlans();
  const defaultPlan = plans.find((p) => p.isDefault) ?? plans[0] ?? DEFAULT_RATE_PLAN;

  const [row] = await sql<{ rate_plan_id: string }[]>`
    SELECT rate_plan_id FROM date_rate_plans WHERE date = ${checkin}
  `;
  if (!row) return defaultPlan;
  return plans.find((p) => p.id === row.rate_plan_id) ?? defaultPlan;
}

export async function applyRatePlanToDates(ratePlanId: string, dates: string[]): Promise<void> {
  await ensureSchema();
  if (dates.length === 0) return;
  const rows = dates.map((date) => ({ date, rate_plan_id: ratePlanId }));
  await sql`
    INSERT INTO date_rate_plans ${sql(rows, "date", "rate_plan_id")}
    ON CONFLICT (date) DO UPDATE SET rate_plan_id = excluded.rate_plan_id
  `;
}
