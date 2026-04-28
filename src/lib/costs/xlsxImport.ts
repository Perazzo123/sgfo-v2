import * as XLSX from "xlsx";
import { parseMoneyBRL, normalizeHeader } from "@/lib/people/types";
import {
  BUDGET_CATEGORY_LABELS,
  type BudgetBreakdown,
  type BudgetCategoryKey,
} from "./types";

/**
 * Resultado da extração do orçamento a partir de uma planilha Excel
 * (`.xlsx` / `.xlsm` / `.xls`).
 *
 * Estratégia:
 *  1. Tenta o parser ESTRUTURADO da aba `VISAO GERENCIAL` (modelo padrão da Zig:
 *     evento, contrato, endereço, datas e tabela "Categoria / SubCategoria"
 *     com colunas "Orçamento Cliente Aprovado" e "Orçamento Zig").
 *  2. Se a aba não existir ou falhar, cai para o parser GENÉRICO que varre
 *     todas as abas atrás de "TOTAL DE DESPESAS" e subtotais por categoria.
 *
 * Quando o modelo "Visão Gerencial" é detectado, o resultado expõe AS DUAS
 * colunas (Cliente Aprovado vs Zig). A UI deixa o usuário trocar a coluna
 * usada como Budget Total sem reimportar.
 */
export type BudgetXlsxExtraction = {
  fileName: string;
  total: number | null;
  breakdown: BudgetBreakdown;
  eventName: string | null;
  contractId: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  sourceSheet: string | null;
  sheetNames: string[];
  warnings: string[];
  debug: BudgetXlsxDebugItem[];
  /**
   * Quando o parser entende as duas colunas do "Visão Gerencial", coloca aqui
   * as opções para o usuário escolher qual coluna vira o Budget Total.
   */
  options: BudgetXlsxOption[];
  /** Qual opção foi aplicada como total. */
  selectedOptionId: BudgetXlsxOption["id"] | null;
};

export type BudgetXlsxOption = {
  id: "cliente" | "zig";
  label: string;
  total: number;
  breakdown: BudgetBreakdown;
};

export type BudgetXlsxDebugItem = {
  field: string;
  sheet: string;
  cell: string;
  matchedText: string;
  value: number | string | null;
};

const empty = (
  fileName: string,
  sheetNames: string[] = [],
  warnings: string[] = []
): BudgetXlsxExtraction => ({
  fileName,
  total: null,
  breakdown: {},
  eventName: null,
  contractId: null,
  startDate: null,
  endDate: null,
  location: null,
  sourceSheet: null,
  sheetNames,
  warnings,
  debug: [],
  options: [],
  selectedOptionId: null,
});

/** Nome de aba no Excel: "Visão Gerencial", "1. Visão Gerencial", "VISÃO GERENCIAL 2024", etc. */
function findVisaoGerencialSheetName(sheetNames: string[]): string | undefined {
  for (const n of sheetNames) {
    const h = normalizeHeader(n).replace(/\s+/g, " ");
    if (h === "visao gerencial") return n;
    const noPrefix = h.replace(/^[\d.()\s\-–—:]+/u, "").trim();
    if (noPrefix === "visao gerencial" || noPrefix.startsWith("visao gerencial")) return n;
  }
  return undefined;
}

/** Cabeçalho: Categoria(s) + Subcategoria (com ou sem espaço no "sub"). */
function isCategoriaSubcategoriaHeader(a: string, b: string): boolean {
  const na = normalizeHeader(a);
  const nb = normalizeHeader(b);
  const catOk =
    na === "categorias" ||
    na === "categoria" ||
    na.startsWith("categorias") ||
    na.startsWith("categoria");
  const nbc = nb.replace(/[^a-z0-9]/g, "");
  const subOk =
    nbc === "subcategoria" ||
    nbc === "subcategorias" ||
    nbc.startsWith("subcateg") ||
    (nbc.includes("sub") && nbc.includes("categ"));
  return catOk && subOk;
}

function visaoExtractionUnusable(vis: BudgetXlsxExtraction): boolean {
  if (vis.options.length > 0) return false;
  const t = vis.total;
  if (t !== null && t > 0) return false;
  if (Object.keys(vis.breakdown).length > 0) return false;
  return true;
}

function mergeVisaoWithGeneric(vis: BudgetXlsxExtraction, gen: BudgetXlsxExtraction): BudgetXlsxExtraction {
  const note =
    "A leitura detalhada da aba Visão Gerencial não definiu o previsto; foi aplicada a varredura geral do arquivo (totais e categorias nas abas).";
  return {
    ...gen,
    eventName: vis.eventName ?? gen.eventName,
    contractId: vis.contractId ?? gen.contractId,
    startDate: vis.startDate ?? gen.startDate,
    endDate: vis.endDate ?? gen.endDate,
    location: vis.location ?? gen.location,
    sourceSheet: gen.sourceSheet ?? vis.sourceSheet,
    fileName: vis.fileName,
    sheetNames: vis.sheetNames,
    debug: vis.debug.length ? [...vis.debug, ...gen.debug] : gen.debug,
    warnings: [note, ...vis.warnings, ...gen.warnings].filter(
      (w, i, arr) => w && arr.indexOf(w) === i
    ),
  };
}

export async function extractBudgetFromXlsx(file: File): Promise<BudgetXlsxExtraction> {
  if (!file) return empty("");
  const buf = await file.arrayBuffer();
  if (!buf?.byteLength) return empty(file.name, [], ["Arquivo vazio."]);

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: false });
  } catch (e) {
    return empty(file.name, [], [
      `Falha ao abrir o Excel (${e instanceof Error ? e.message : "erro desconhecido"}).`,
    ]);
  }

  const sheetNames = wb.SheetNames.slice();
  if (!sheetNames.length) {
    return empty(file.name, [], ["Nenhuma aba encontrada no arquivo."]);
  }

  const visaoName = findVisaoGerencialSheetName(sheetNames);
  if (visaoName && wb.Sheets[visaoName]) {
    const structured = parseVisaoGerencial(wb.Sheets[visaoName], visaoName, file.name);
    structured.sheetNames = sheetNames;
    if (visaoExtractionUnusable(structured)) {
      const generic = parseGeneric(wb, sheetNames, file.name);
      return mergeVisaoWithGeneric(structured, generic);
    }
    return structured;
  }

  return parseGeneric(wb, sheetNames, file.name);
}

function parseVisaoGerencial(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  fileName: string
): BudgetXlsxExtraction {
  const out = empty(fileName, [], []);
  out.sourceSheet = sheetName;

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  }) as unknown[][];

  const cellAt = (r0: number, c0: number): unknown => aoa[r0]?.[c0];

  const findValueRight = (label: string): { value: unknown; cell: string } | null => {
    const ln = normalizeHeader(label);
    for (let r = 0; r < Math.min(aoa.length, 10); r++) {
      const row = aoa[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        const t = String(row[c] ?? "").trim();
        if (!t) continue;
        if (normalizeHeader(t).startsWith(ln)) {
          for (let c2 = c + 1; c2 < Math.min(row.length, c + 6); c2++) {
            const v = row[c2];
            if (v !== "" && v !== null && v !== undefined) {
              return { value: v, cell: addr(r, c2) };
            }
          }
        }
      }
    }
    return null;
  };

  const evento = findValueRight("Evento");
  if (evento) {
    out.eventName = String(evento.value).trim() || null;
    out.debug.push({ field: "eventName", sheet: sheetName, cell: evento.cell, matchedText: "Evento", value: out.eventName });
  }
  const contrato = findValueRight("Contrato");
  if (contrato) {
    out.contractId = formatContract(contrato.value);
    out.debug.push({ field: "contractId", sheet: sheetName, cell: contrato.cell, matchedText: "Contrato", value: out.contractId });
  }
  const endereco = findValueRight("ENDEREÇO EVENTO") ?? findValueRight("Endereço Evento") ?? findValueRight("Endereço");
  if (endereco) {
    out.location = String(endereco.value).trim() || null;
    out.debug.push({ field: "location", sheet: sheetName, cell: endereco.cell, matchedText: "Endereço Evento", value: out.location });
  }
  const horIni = findValueRight("Horário Início") ?? findValueRight("Horario Inicio") ?? findValueRight("Início");
  if (horIni) {
    const v = formatDateMaybe(horIni.value);
    if (v) {
      out.startDate = v;
      out.debug.push({ field: "startDate", sheet: sheetName, cell: horIni.cell, matchedText: "Horário Início", value: v });
    }
  }
  const horFim = findValueRight("Horário Fim") ?? findValueRight("Horario Fim") ?? findValueRight("Fim");
  if (horFim) {
    const v = formatDateMaybe(horFim.value);
    if (v) {
      out.endDate = v;
      out.debug.push({ field: "endDate", sheet: sheetName, cell: horFim.cell, matchedText: "Horário Fim", value: v });
    }
  }

  let headerRow = -1;
  for (let r = 0; r < Math.min(aoa.length, 40); r++) {
    const a = String(cellAt(r, 0) ?? "").trim();
    const b = String(cellAt(r, 1) ?? "").trim();
    if (isCategoriaSubcategoriaHeader(a, b)) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    out.warnings.push(
      `Aba "${sheetName}" reconhecida, mas não encontrei o bloco Categoria/Subcategoria (linha de cabeçalho). Será tentada a leitura geral do arquivo.`
    );
    return out;
  }

  const colCliente = 2;
  const colZig = 3;

  const subBreakCliente: Record<BudgetCategoryKey, number> = emptyBreak();
  const subBreakZig: Record<BudgetCategoryKey, number> = emptyBreak();
  let totalRow = -1;
  let totalCliente: number | null = null;
  let totalZig: number | null = null;

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const a = String(cellAt(r, 0) ?? "").trim();
    const b = String(cellAt(r, 1) ?? "").trim();
    if (!a && !b) continue;

    if (normalizeHeader(b) === "total" || normalizeHeader(a) === "total") {
      totalRow = r;
      totalCliente = num(cellAt(r, colCliente));
      totalZig = num(cellAt(r, colZig));
      break;
    }

    const key = mapCategoryToKey(a);
    if (!key) continue;
    const vCliente = num(cellAt(r, colCliente));
    const vZig = num(cellAt(r, colZig));
    if (vCliente !== null) subBreakCliente[key] += vCliente;
    if (vZig !== null) subBreakZig[key] += vZig;
  }

  const breakdownCliente = pruneBreak(subBreakCliente);
  const breakdownZig = pruneBreak(subBreakZig);

  if (totalCliente === null) totalCliente = sumBreak(breakdownCliente);
  if (totalZig === null) totalZig = sumBreak(breakdownZig);

  if (totalRow >= 0) {
    out.debug.push({
      field: "total.cliente",
      sheet: sheetName,
      cell: addr(totalRow, colCliente),
      matchedText: "TOTAL · Orçamento Cliente Aprovado",
      value: totalCliente,
    });
    out.debug.push({
      field: "total.zig",
      sheet: sheetName,
      cell: addr(totalRow, colZig),
      matchedText: "TOTAL · Orçamento Zig",
      value: totalZig,
    });
  }

  for (const k of Object.keys(breakdownCliente) as BudgetCategoryKey[]) {
    out.debug.push({
      field: `breakdown.cliente.${k}`,
      sheet: sheetName,
      cell: "C",
      matchedText: BUDGET_CATEGORY_LABELS[k],
      value: breakdownCliente[k] ?? 0,
    });
  }
  for (const k of Object.keys(breakdownZig) as BudgetCategoryKey[]) {
    out.debug.push({
      field: `breakdown.zig.${k}`,
      sheet: sheetName,
      cell: "D",
      matchedText: BUDGET_CATEGORY_LABELS[k],
      value: breakdownZig[k] ?? 0,
    });
  }

  const options: BudgetXlsxOption[] = [];
  if ((totalZig ?? 0) > 0) {
    options.push({
      id: "zig",
      label: `Orçamento Zig · R$ ${formatBR(totalZig!)}`,
      total: totalZig!,
      breakdown: breakdownZig,
    });
  }
  if ((totalCliente ?? 0) > 0) {
    options.push({
      id: "cliente",
      label: `Orçamento Cliente Aprovado · R$ ${formatBR(totalCliente!)}`,
      total: totalCliente!,
      breakdown: breakdownCliente,
    });
  }
  out.options = options;

  if (options.length > 0) {
    out.selectedOptionId = options[0]!.id;
    out.total = options[0]!.total;
    out.breakdown = options[0]!.breakdown;
  } else {
    out.warnings.push(
      "Não calculei total na tabela da Visão Gerencial (linha TOTAL ou colunas de orçamento vazias). Tente a varredura geral do arquivo abaixo ou preencha manualmente."
    );
  }

  return out;
}

function emptyBreak(): Record<BudgetCategoryKey, number> {
  return {
    maoDeObra: 0,
    transporte: 0,
    hospedagem: 0,
    alimentacao: 0,
    frete: 0,
    outros: 0,
  };
}

function pruneBreak(b: Record<BudgetCategoryKey, number>): BudgetBreakdown {
  const out: BudgetBreakdown = {};
  for (const k of Object.keys(b) as BudgetCategoryKey[]) {
    if (b[k] && b[k] !== 0) out[k] = round2(b[k]);
  }
  return out;
}

function sumBreak(b: BudgetBreakdown): number {
  return round2(
    (Object.values(b) as number[]).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0)
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Mapeia a string da coluna A da "Visão Gerencial" (em PT-BR, com acento) para
 * a chave canônica do `BudgetBreakdown`.
 */
function mapCategoryToKey(label: string): BudgetCategoryKey | null {
  const n = normalizeHeader(label);
  if (!n) return null;
  if (n.startsWith("mao de obra") || n.startsWith("mao-de-obra") || n.includes("mao de obra")) return "maoDeObra";
  if (n.startsWith("alimenta")) return "alimentacao";
  if (n.startsWith("transporte")) return "transporte";
  if (n.startsWith("hospedagem")) return "hospedagem";
  if (n.startsWith("frete")) return "frete";
  if (n.startsWith("desconto")) return "outros";
  if (n.startsWith("outros") || n.startsWith("diversos")) return "outros";
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = parseMoneyBRL(t);
    return n === null || !Number.isFinite(n) ? null : n;
  }
  return null;
}

function formatBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatContract(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return String(Math.round(v));
  const s = String(v).trim();
  return s || null;
}

function formatDateMaybe(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 1000) {
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const yy = d.getUTCFullYear();
      return `${dd}/${mm}/${yy}`;
    }
  }
  return String(v).trim() || null;
}

function addr(r0: number, c0: number): string {
  return `${colLetter(c0)}${r0 + 1}`;
}

function colLetter(c: number): string {
  let s = "";
  let n = c;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** ------------------------------------------------------------------------ */
/** Parser genérico (fallback) — varre todas as abas. */
/** ------------------------------------------------------------------------ */

type Cell = {
  r: number;
  c: number;
  raw: unknown;
  text: string;
  num: number | null;
  norm: string;
};

const TOTAL_KEYWORDS = [
  "total de despesas",
  "total das despesas",
  "total despesas",
  "despesa total",
  "total geral",
  "valor total",
  "total do orcamento",
  "total orcamento",
  "total",
];

const CATEGORY_KEYWORDS: Record<BudgetCategoryKey, string[]> = {
  maoDeObra: [
    "total mao de obra",
    "subtotal mao de obra",
    "mao de obra",
    "mao-de-obra",
    "rh",
    "freelancers",
    "freela",
  ],
  transporte: [
    "total transporte",
    "subtotal transporte",
    "transporte",
    "deslocamento",
    "passagens",
    "passagem",
  ],
  hospedagem: [
    "total hospedagem",
    "subtotal hospedagem",
    "hospedagem",
    "hotel",
    "diarias",
    "diaria",
  ],
  alimentacao: [
    "total alimentacao",
    "subtotal alimentacao",
    "alimentacao",
    "refeicao",
    "refeicoes",
    "alimentos",
  ],
  frete: ["total frete", "subtotal frete", "frete", "fretes", "logistica"],
  outros: [
    "total outros",
    "subtotal outros",
    "outros",
    "diversos",
    "miscelania",
    "miscelanea",
  ],
};

function parseGeneric(
  wb: XLSX.WorkBook,
  sheetNames: string[],
  fileName: string
): BudgetXlsxExtraction {
  const out = empty(fileName, sheetNames);
  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const cells = sheetCells(sheet);
    if (!cells.length) continue;

    if (out.total === null) {
      const t = findTotal(cells);
      if (t) {
        out.total = t.value;
        out.sourceSheet = sheetName;
        out.debug.push({
          field: "total",
          sheet: sheetName,
          cell: addr(t.label.r, t.label.c),
          matchedText: t.label.text,
          value: t.value,
        });
      }
    }

    for (const key of Object.keys(CATEGORY_KEYWORDS) as BudgetCategoryKey[]) {
      if (out.breakdown[key] !== undefined) continue;
      const m = findCategory(cells, CATEGORY_KEYWORDS[key]);
      if (m) {
        out.breakdown[key] = m.value;
        out.debug.push({
          field: `breakdown.${key}`,
          sheet: sheetName,
          cell: addr(m.label.r, m.label.c),
          matchedText: m.label.text,
          value: m.value,
        });
      }
    }
  }

  if (out.total === null) {
    out.warnings.push(
      "Não foi possível identificar a linha 'TOTAL DE DESPESAS' nas abas. Preencha o Budget total manualmente."
    );
  }
  if (Object.keys(out.breakdown).length === 0) {
    out.warnings.push(
      "Nenhuma categoria de despesa foi detectada. Você pode preencher a quebra manualmente."
    );
  }
  return out;
}

function sheetCells(sheet: XLSX.WorkSheet): Cell[] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  if (!aoa) return [];
  const out: Cell[] = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const raw = row[c];
      if (raw === null || raw === undefined || raw === "") continue;
      const text = typeof raw === "string" ? raw.trim() : String(raw).trim();
      const n = toNumberCell(raw);
      out.push({ r, c, raw, text, num: n, norm: normalizeHeader(text) });
    }
  }
  return out;
}

function toNumberCell(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    const looksLikeMoney = (/\d/.test(t) && /[.,]/.test(t)) || /^[\d\s]+$/.test(t);
    if (!looksLikeMoney) return null;
    const n = parseMoneyBRL(t);
    return n === null || !Number.isFinite(n) ? null : n;
  }
  return null;
}

type GenericMatch = { label: Cell; value: number };

function findTotal(cells: Cell[]): GenericMatch | null {
  const labels = cells
    .filter((c) => c.num === null && TOTAL_KEYWORDS.some((kw) => c.norm.includes(kw)))
    .sort((a, b) => b.norm.length - a.norm.length);
  for (const lab of labels) {
    const v = neighbourNumber(cells, lab);
    if (v !== null) return { label: lab, value: v };
  }
  return null;
}

function findCategory(cells: Cell[], keywords: string[]): GenericMatch | null {
  const candidates: { lab: Cell; kwIdx: number }[] = [];
  for (const cell of cells) {
    if (cell.num !== null) continue;
    for (let i = 0; i < keywords.length; i++) {
      if (cell.norm.includes(keywords[i]!)) {
        candidates.push({ lab: cell, kwIdx: i });
        break;
      }
    }
  }
  candidates.sort((a, b) => a.kwIdx - b.kwIdx);
  for (const { lab } of candidates) {
    const v = neighbourNumber(cells, lab);
    if (v !== null && v > 0) return { label: lab, value: v };
  }
  return null;
}

function neighbourNumber(cells: Cell[], lab: Cell): number | null {
  const sameRowRight = cells
    .filter((c) => c.r === lab.r && c.c > lab.c && c.num !== null)
    .sort((a, b) => a.c - b.c)[0];
  if (sameRowRight?.num != null) return sameRowRight.num;

  const sameColBelow = cells
    .filter((c) => c.c === lab.c && c.r > lab.r && c.num !== null)
    .sort((a, b) => a.r - b.r)[0];
  if (sameColBelow && sameColBelow.r - lab.r <= 5 && sameColBelow.num != null) return sameColBelow.num;

  const sameRowLeft = cells
    .filter((c) => c.r === lab.r && c.c < lab.c && c.num !== null)
    .sort((a, b) => b.c - a.c)[0];
  if (sameRowLeft?.num != null) return sameRowLeft.num;

  return null;
}
