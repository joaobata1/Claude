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
  checkout: "checkout",
  "check out": "checkout",
  adultos: "adults",
  criancas: "children",
  crianças: "children",
  plataforma: "source",
  reserva: "bookingReference",
  valor: "totalPrice",
  comissao: "commissionAmount",
  comissão: "commissionAmount",
  limpeza: "cleaningCost",
};

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
  const match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${y}-${month}-${day}`;
}

function parsePtNumber(raw: string | undefined): number | null {
  const cleaned = cleanText(raw);
  if (!cleaned || cleaned === "-" || cleaned === "—") return null;
  // formato português: ponto = separador de milhares, vírgula = decimal
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
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

  // deteta e ignora a linha de cabeçalho, se a primeira célula for "Nome"
  const firstCellIsHeader = normalizeHeaderKey(rows[0][0] ?? "") === "nome";
  const headerRow = firstCellIsHeader ? rows[0] : null;
  const dataRows = firstCellIsHeader ? rows.slice(1) : rows;

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
    const guestsCount = adults + children || 1;

    return {
      raw: row,
      guestName,
      guestPhone: cell(row, "guestPhone"),
      checkin,
      checkout,
      guestsCount,
      source: mapSource(cell(row, "source")),
      bookingReference: cell(row, "bookingReference"),
      totalPrice: parsePtNumber(cell(row, "totalPrice")),
      commissionAmount: parsePtNumber(cell(row, "commissionAmount")) ?? 0,
      cleaningCost: parsePtNumber(cell(row, "cleaningCost")) ?? 0,
      errors,
    };
  });
}
