/**
 * Feriados nacionais (comuns a todo o país — não inclui feriados regionais/locais,
 * que variam por município/estado/comunidade autónoma) para Portugal, Alemanha e
 * Espanha. Usado só para referência visual no calendário do backoffice.
 */

export type HolidayCountry = "PT" | "DE" | "ES";

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  country: HolidayCountry;
}

/** Algoritmo de Gauss/Meeus-Jones-Butcher — validado contra datas conhecidas (2023-2028) */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fixed(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getHolidays(year: number, country: HolidayCountry): Holiday[] {
  const easter = easterSunday(year);

  if (country === "PT") {
    return [
      { date: fixed(year, 1, 1), name: "Ano Novo", country },
      { date: iso(addDaysUTC(easter, -2)), name: "Sexta-feira Santa", country },
      { date: iso(easter), name: "Páscoa", country },
      { date: fixed(year, 4, 25), name: "Dia da Liberdade", country },
      { date: fixed(year, 5, 1), name: "Dia do Trabalhador", country },
      { date: iso(addDaysUTC(easter, 60)), name: "Corpo de Deus", country },
      { date: fixed(year, 6, 10), name: "Dia de Portugal", country },
      { date: fixed(year, 8, 15), name: "Assunção de Nossa Senhora", country },
      { date: fixed(year, 10, 5), name: "Implantação da República", country },
      { date: fixed(year, 11, 1), name: "Dia de Todos os Santos", country },
      { date: fixed(year, 12, 1), name: "Restauração da Independência", country },
      { date: fixed(year, 12, 8), name: "Imaculada Conceição", country },
      { date: fixed(year, 12, 25), name: "Natal", country },
    ];
  }

  if (country === "DE") {
    return [
      { date: fixed(year, 1, 1), name: "Neujahr", country },
      { date: iso(addDaysUTC(easter, -2)), name: "Karfreitag", country },
      { date: iso(addDaysUTC(easter, 1)), name: "Ostermontag", country },
      { date: fixed(year, 5, 1), name: "Tag der Arbeit", country },
      { date: iso(addDaysUTC(easter, 39)), name: "Christi Himmelfahrt", country },
      { date: iso(addDaysUTC(easter, 50)), name: "Pfingstmontag", country },
      { date: fixed(year, 10, 3), name: "Tag der Deutschen Einheit", country },
      { date: fixed(year, 12, 25), name: "1. Weihnachtstag", country },
      { date: fixed(year, 12, 26), name: "2. Weihnachtstag", country },
    ];
  }

  // ES
  return [
    { date: fixed(year, 1, 1), name: "Año Nuevo", country },
    { date: fixed(year, 1, 6), name: "Epifanía del Señor", country },
    { date: iso(addDaysUTC(easter, -2)), name: "Viernes Santo", country },
    { date: fixed(year, 5, 1), name: "Fiesta del Trabajo", country },
    { date: fixed(year, 8, 15), name: "Asunción de la Virgen", country },
    { date: fixed(year, 10, 12), name: "Fiesta Nacional de España", country },
    { date: fixed(year, 11, 1), name: "Todos los Santos", country },
    { date: fixed(year, 12, 6), name: "Día de la Constitución", country },
    { date: fixed(year, 12, 8), name: "Inmaculada Concepción", country },
    { date: fixed(year, 12, 25), name: "Navidad", country },
  ];
}

/** Feriados de todos os países cobertos, para um ano — indexados por data para acesso rápido. */
export function getAllHolidaysByDate(year: number): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>();
  for (const country of ["PT", "DE", "ES"] as HolidayCountry[]) {
    for (const h of getHolidays(year, country)) {
      const list = map.get(h.date) ?? [];
      list.push(h);
      map.set(h.date, list);
    }
  }
  return map;
}
