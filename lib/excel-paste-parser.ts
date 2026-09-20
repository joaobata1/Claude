/**
 * Interpreta dados colados do Excel (formato: uma linha de cabeçalho opcional +
 * linhas de dados, colunas separadas por tabulação — exatamente o que o Excel
 * produz ao copiar um intervalo de células e colar como texto).
 *
 * Feito para ser tolerante a dados reais: várias colunas com o mesmo nome
 * (usa a última), datas em D/M/AAAA ou D-M-AAAA, números em formato português
 * (vírgula decimal), e caracteres invisíveis que por vezes vêm colados
 * (marcas de direção de texto, espaços de largura zero).
 */

export interface ParsedImportRow {
  raw: string[];
  guestName: string;
  guestPhone: string;
  checkin: string | null; // YYYY-MM-DD
  checkout: string | null;
  guestsCount: number;
  source: string; // airbnb | booking | vrbo | outros
  bookingReference: string;
  totalPrice: number | null;
  commissionAmount: number;
  cleaningCost: number;
  errors: string[];
}

const HEADER_ALIASES: Record<string, string> = {
  nome: "guestName",
  contacto: "guestPhone",
  checkin: "checkin",
  "check in": "checkin",
  "check-in": "checkin",
  checkout: "checkout",
  "check out": "checkout",
  "check-out": "checkout",
  adultos: "adults",
  criancas: "children",
  plataforma: "source",
  reserva: "bookingReference",
  valor: "totalPrice",
  comissao: "commissionAmount",
  limpeza: "cleaningCost",
  // Colunas da exportação oficial do Booking.com (Extranet → Reservas → exportar)
  "numero da reserva": "bookingReference",
  "nome do hospede": "guestName",
  estado: "status",
  pessoas: "people",
  preco: "totalPrice",
  "valor da comissao": "commissionAmount",
  "numero de telefone": "guestPhone",
  "booker country": "country",
};

/** Estados do Booking que não devem entrar no calendário. */
function isCancelledStatus(raw: string): boolean {
  const s = normalizeHeaderKey(raw);
  return s.includes("cancel") || s.includes("no_show") || s.includes("no show");
}

function cleanText(raw: string | undefined): string {
  if (!raw) return "";
  // remove marcas de direção de texto (RTL/LTR) e espaços de largura zero, que às vezes vêm colados
  return raw.replace(/[​-‏‪-‮﻿]/g, "").trim();
}

function normalizeHeaderKey(raw: string): string {
  return cleanText(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos para comparar (crianças -> criancas)
}

function parsePtDate(raw: string): string | null {
  const cleaned = cleanText(raw);

  // A exportação do Booking já traz as datas em YYYY-MM-DD (por vezes com hora a seguir).
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) return `${y}-${m}-${d}`;
    return null;
  }

  const match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${y}-${month}-${day}`;
}

/**
 * Lê um número que pode vir em formato português ("1.234,56"), inglês ("1,234.56")
 * ou como o Booking.com o exporta ("425.65 EUR", "80.8735 EUR").
 *
 * A regra do último separador: se depois dele vierem exatamente 3 dígitos, era
 * separador de milhares; caso contrário, é a vírgula decimal. Sem isto, "425.65 EUR"
 * era lido como 42565 — cem vezes o valor real da reserva.
 */
function parsePtNumber(raw: string | undefined): number | null {
  const cleaned = cleanText(raw);
  if (!cleaned || cleaned === "-" || cleaned === "—") return null;

  // tira moeda e espaços: "425.65 EUR" -> "425.65"
  const semMoeda = cleaned.replace(/[^\d.,-]/g, "");
  if (!semMoeda || !/\d/.test(semMoeda)) return null;

  const ultimoPonto = semMoeda.lastIndexOf(".");
  const ultimaVirgula = semMoeda.lastIndexOf(",");
  const corte = Math.max(ultimoPonto, ultimaVirgula);

  let normalizado: string;
  if (corte === -1) {
    normalizado = semMoeda;
  } else {
    const decimais = semMoeda.length - corte - 1;
    if (decimais === 3) {
      // separador de milhares (ex: "1.560" = mil quinhentos e sessenta)
      normalizado = semMoeda.replace(/[.,]/g, "");
    } else {
      const inteiro = semMoeda.slice(0, corte).replace(/[.,]/g, "");
      normalizado = `${inteiro}.${semMoeda.slice(corte + 1)}`;
    }
  }

  const n = parseFloat(normalizado);
  return isNaN(n) ? null : n;
}

function mapSource(raw: string): string {
  const s = normalizeHeaderKey(raw);
  if (s.includes("airbnb")) return "airbnb";
  if (s.includes("booking")) return "booking";
  if (s.includes("vrbo") || s.includes("homeaway")) return "vrbo";
  return "outros";
}

/** Divide texto colado em linhas de células, ignorando linhas totalmente vazias. */
function splitRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map(cleanText))
    .filter((cells) => cells.some((c) => c !== ""));
}

export function parseExcelPaste(text: string): ParsedImportRow[] {
  const rows = splitRows(text);
  if (rows.length === 0) return [];

  // É cabeçalho se pelo menos duas células forem nomes de coluna conhecidos. Antes só
  // reconhecia a folha do próprio utilizador (primeira célula "Nome"), pelo que o
  // cabeçalho do Booking ("Número da reserva", ...) era tratado como uma reserva.
  const knownInFirstRow = rows[0].filter((c) => HEADER_ALIASES[normalizeHeaderKey(c)]).length;
  const firstCellIsHeader = knownInFirstRow >= 2;
  const headerRow = firstCellIsHeader ? rows[0] : null;
  const dataRows = firstCellIsHeader ? rows.slice(1) : rows;

  // A exportação do Booking não tem coluna "Plataforma" — identifica-se pelas suas colunas.
  const looksLikeBooking =
    !!headerRow && headerRow.some((c) => normalizeHeaderKey(c) === "booker country");

  // mapeia nome de coluna -> índice; havendo colunas repetidas (ex: "Contacto" duas vezes), fica a última
  const columnIndex: Record<string, number> = {};
  if (headerRow) {
    headerRow.forEach((cell, i) => {
      const field = HEADER_ALIASES[normalizeHeaderKey(cell)];
      if (field) columnIndex[field] = i;
    });
  } else {
    // sem cabeçalho: assume a ordem do formato de referência (ver LEIA-ME / exportação CSV existente)
    const defaultOrder = [
      "guestName", "guestPhone", "checkin", "checkout", null, null,
      "adults", "children", null, "source", null, "bookingReference",
      "guestPhone", "totalPrice", "commissionAmount", "cleaningCost",
    ];
    defaultOrder.forEach((field, i) => {
      if (field) columnIndex[field] = i;
    });
  }

  function cell(row: string[], field: string): string {
    const i = columnIndex[field];
    return i !== undefined ? (row[i] ?? "") : "";
  }

  return dataRows.map((row): ParsedImportRow => {
    const errors: string[] = [];

    const guestName = cell(row, "guestName");
    if (!guestName) errors.push("Nome em falta.");

    const checkin = parsePtDate(cell(row, "checkin"));
    if (cell(row, "checkin") && !checkin) errors.push("Check in em formato inválido.");
    else if (!checkin) errors.push("Check in em falta.");

    const checkout = parsePtDate(cell(row, "checkout"));
    if (cell(row, "checkout") && !checkout) errors.push("Check out em formato inválido.");
    else if (!checkout) errors.push("Check out em falta.");

    if (checkin && checkout && checkout <= checkin) errors.push("Check out tem de ser depois do check in.");

    const adults = parseInt(cell(row, "adults"), 10) || 0;
    const children = parseInt(cell(row, "children"), 10) || 0;
    const people = parseInt(cell(row, "people"), 10) || 0;
    const guestsCount = people || adults + children || 1;

    // A exportação inclui as reservas canceladas. Importá-las bloquearia no calendário
    // datas que estão livres — noites que deixariam de poder ser vendidas.
    const status = cell(row, "status");
    if (status && isCancelledStatus(status)) {
      errors.push(`Reserva cancelada na plataforma (${status}) — não é importada.`);
    }

    return {
      raw: row,
      guestName,
      guestPhone: cell(row, "guestPhone"),
      checkin,
      checkout,
      guestsCount,
      source: looksLikeBooking ? "booking" : mapSource(cell(row, "source")),
      bookingReference: cell(row, "bookingReference"),
      totalPrice: parsePtNumber(cell(row, "totalPrice")),
      commissionAmount: parsePtNumber(cell(row, "commissionAmount")) ?? 0,
      cleaningCost: parsePtNumber(cell(row, "cleaningCost")) ?? 0,
      errors,
    };
  });
}
