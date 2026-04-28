/**
 * Parser puro do Fechamento Financeiro (modelo Zig). Recebe texto extraído por outro
 * meio (pdfjs-dist, pdf-parse, etc.) e devolve totais + lançamentos individuais.
 *
 * Sem dependências de DOM / browser → roda em Node (route handler) e no cliente.
 */
import { parseMoneyBRL, normalizeHeader } from "@/lib/people/types";

export type FinancialClosingDebugItem = {
  field: "teamCanto" | "otherExpenses";
  sheet: string;
  cell: string;
  matchedText: string;
  value: number | null;
};

export type FinancialClosingCategory =
  | "Mão de Obra"
  | "Transporte"
  | "Hospedagem"
  | "Alimentação"
  | "Frete"
  | "Outros";

export type FinancialClosingEntry = {
  /** "team" = Equipe de Campo · "other" = Demais Despesas. */
  group: "team" | "other";
  /** Rubrica detectada (ex.: "Diárias Head", "Hospedagem", "Frete"). */
  label: string;
  /** Valor em magnitude positiva. */
  amount: number;
  /** Categoria sugerida para a tabela de custos. */
  category: FinancialClosingCategory;
};

export type FinancialClosingExtraction = {
  fileName: string;
  teamCanto: number | null;
  otherExpenses: number | null;
  total: number;
  sourceSheet: string | null;
  sheetNames: string[];
  warnings: string[];
  debug: FinancialClosingDebugItem[];
  /** Lançamentos individuais (rubrica + valor + categoria). */
  entries: FinancialClosingEntry[];
};

function parseMoneyClosing(raw: string): number | null {
  const t = raw.trim();
  const plain = parseMoneyBRL(t);
  if (plain !== null) return plain;
  if (/^\(.*\)$/.test(t.replace(/\s/g, ""))) {
    const inner = t.replace(/^\s*\(\s*/, "").replace(/\s*\)\s*$/, "");
    const v = parseMoneyBRL(inner);
    return v !== null ? -Math.abs(v) : null;
  }
  if (/^-\s*/.test(t)) {
    const v = parseMoneyBRL(t.replace(/^-\s*/, ""));
    return v !== null ? -Math.abs(v) : null;
  }
  return null;
}

/** Último montante em ocorrências `total …` (não Final) — funciona com ou sem \n. */
function lastZigTotalInSlice(slice: string): number | null {
  let last: number | null = null;
  const re = /total\s+(?!final\b)\s*(-?(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const v = parseMoneyClosing(m[1]!);
    if (v !== null) last = Math.abs(v);
  }
  return last;
}

const MONEY_TOKEN = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

/** Último montante (decimal com vírgula) numa fatia — para apanhar o valor da rubrica antes da próxima. */
function lastMoneyInSlice(slice: string): number | null {
  const all = slice.match(MONEY_TOKEN);
  if (!all || !all.length) return null;
  const v = parseMoneyClosing(all[all.length - 1]!);
  return v !== null ? Math.abs(v) : null;
}

/** Restaura acentos comuns perdidos no `normalizeHeader` para rótulos típicos da Equipe de Campo. */
const TEAM_LABEL_OVERRIDES: Record<string, string> = {
  tecnico: "Técnico",
  head: "Head",
  supervisor: "Supervisor",
  operador: "Operador",
  backoffice: "Backoffice",
};

function titleCase(word: string): string {
  if (!word) return word;
  const norm = word.trim().toLowerCase();
  if (TEAM_LABEL_OVERRIDES[norm]) return TEAM_LABEL_OVERRIDES[norm]!;
  return norm.charAt(0).toUpperCase() + norm.slice(1);
}

/**
 * Detecta rubricas dentro do bloco "Equipe de Campo": "Diárias Head", "Diárias Supervisor",
 * "Diárias Técnico" — e quaisquer outras "Diárias <tipo>" no mesmo padrão. Apanha só a primeira
 * ocorrência de cada tipo (a lista descritiva repete o termo).
 */
function parseTeamItems(slice: string): FinancialClosingEntry[] {
  type Pos = { key: string; idx: number };
  const seen = new Map<string, number>();
  for (const m of slice.matchAll(/\bdiarias\s+(\w[\w\s]*?)(?=\s*-)/gi)) {
    const k = (m[1] ?? "").trim().toLowerCase();
    if (!k) continue;
    if (!seen.has(k)) seen.set(k, m.index ?? 0);
  }
  const positions: Pos[] = [...seen.entries()]
    .map(([key, idx]) => ({ key, idx }))
    .sort((a, b) => a.idx - b.idx);
  if (!positions.length) return [];

  const out: FinancialClosingEntry[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]!.idx;
    const nextIdx = positions[i + 1]?.idx ?? slice.length;
    const totalIdx = (() => {
      const m = /total\s+(?!final\b)\s*-?\d/gi.exec(slice.slice(start, nextIdx));
      return m ? start + m.index : nextIdx;
    })();
    const sub = slice.slice(start, Math.min(nextIdx, totalIdx));
    const amount = lastMoneyInSlice(sub);
    if (amount !== null) {
      out.push({
        group: "team",
        label: `Diárias ${titleCase(positions[i]!.key)}`,
        amount,
        category: "Mão de Obra",
      });
    }
  }
  return out;
}

/** Mapeamento rótulo → categoria para Demais Despesas. Ordem importa: pesquisamos por label. */
const OTHER_LABELS: Array<{
  re: RegExp;
  display: string;
  category: FinancialClosingCategory;
}> = [
  { re: /\bhospedagem\b/i, display: "Hospedagem", category: "Hospedagem" },
  { re: /\bfrete\b/i, display: "Frete", category: "Frete" },
  { re: /\btransporte\b/i, display: "Transporte", category: "Transporte" },
  { re: /\balimentacao(?:\s+de\s+viagem|\s+equipe)?\b/i, display: "Alimentação", category: "Alimentação" },
];

/**
 * Detecta rubricas dentro do bloco "Demais Despesas". Para cada label, apanha o último valor
 * na sua fatia (até ao próximo label ou `Total`).
 */
function parseOtherItems(slice: string): FinancialClosingEntry[] {
  type Pos = { display: string; category: FinancialClosingCategory; idx: number };
  const positions: Pos[] = [];
  for (const l of OTHER_LABELS) {
    const m = l.re.exec(slice);
    if (m && m.index !== undefined) {
      positions.push({ display: l.display, category: l.category, idx: m.index });
    }
  }
  positions.sort((a, b) => a.idx - b.idx);
  if (!positions.length) return [];

  const out: FinancialClosingEntry[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]!.idx;
    const nextIdx = positions[i + 1]?.idx ?? slice.length;
    const totalIdx = (() => {
      const m = /total\s+(?!final\b)\s*-?\d/gi.exec(slice.slice(start, nextIdx));
      return m ? start + m.index : nextIdx;
    })();
    const sub = slice.slice(start, Math.min(nextIdx, totalIdx));
    const amount = lastMoneyInSlice(sub);
    if (amount !== null) {
      out.push({
        group: "other",
        label: positions[i]!.display,
        amount,
        category: positions[i]!.category,
      });
    }
  }
  return out;
}

function extractFromText(rawText: string): {
  teamCanto: number | null;
  otherExpenses: number | null;
  flat: string;
  teamSlice: string;
  otherSlice: string;
} {
  const flat = normalizeHeader(rawText);
  let eqIdx = flat.search(/\bequipe\s+de\s+campo\b/);
  if (eqIdx < 0) eqIdx = flat.search(/\bequipe\s+de\s+canto\b/);
  const dmIdx = flat.search(/\bdemais\s+despesas\b/);

  let teamCanto: number | null = null;
  let otherExpenses: number | null = null;
  let teamSlice = "";
  let otherSlice = "";

  if (eqIdx >= 0 && dmIdx > eqIdx) {
    teamSlice = flat.slice(eqIdx, dmIdx);
    teamCanto = lastZigTotalInSlice(teamSlice);
  }
  if (dmIdx >= 0) {
    const after = flat.slice(dmIdx);
    const stopM = after.search(/\bmovimentos\s+de\s+saldos\b/);
    const stopF = after.search(/\btotal\s+final\b/);
    let cut = after.length;
    if (stopM >= 0) cut = Math.min(cut, stopM);
    if (stopF >= 0) cut = Math.min(cut, stopF);
    otherSlice = after.slice(0, cut);
    otherExpenses = lastZigTotalInSlice(otherSlice);
  }
  return { teamCanto, otherExpenses, flat, teamSlice, otherSlice };
}

/**
 * Aplica o parser ao texto bruto do PDF e devolve a extração final.
 * Aceita texto com ou sem quebras de linha.
 */
export function parseFinancialClosingFromText(
  rawText: string,
  fileName: string
): FinancialClosingExtraction {
  const out: FinancialClosingExtraction = {
    fileName,
    teamCanto: null,
    otherExpenses: null,
    total: 0,
    sourceSheet: null,
    sheetNames: ["PDF"],
    warnings: [],
    debug: [],
    entries: [],
  };

  if (!rawText || !rawText.trim()) {
    out.warnings.push(
      "Não foi possível extrair texto do PDF. Se for imagem digitalizada, será preciso OCR."
    );
    return out;
  }

  const { teamCanto, otherExpenses, flat, teamSlice, otherSlice } = extractFromText(rawText);
  out.teamCanto = teamCanto !== null ? Math.abs(teamCanto) : null;
  out.otherExpenses = otherExpenses !== null ? Math.abs(otherExpenses) : null;

  if (out.teamCanto !== null) {
    out.debug.push({
      field: "teamCanto",
      sheet: "PDF",
      cell: "regex",
      matchedText: teamSlice.slice(0, 160),
      value: out.teamCanto,
    });
    out.sourceSheet = "PDF";
  }
  if (out.otherExpenses !== null) {
    out.debug.push({
      field: "otherExpenses",
      sheet: "PDF",
      cell: "regex",
      matchedText: otherSlice.slice(0, 240),
      value: out.otherExpenses,
    });
    out.sourceSheet = out.sourceSheet ?? "PDF";
  }

  /* Quebras por rubrica. */
  const teamEntries = teamSlice ? parseTeamItems(teamSlice) : [];
  const otherEntries = otherSlice ? parseOtherItems(otherSlice) : [];

  /* Reconciliação: se a soma de rubricas diferir do total da secção em mais que 1 centavo,
     adicionamos uma rubrica "Outros" / "Diárias (não classificadas)" com a diferença. */
  if (out.teamCanto !== null) {
    const sum = teamEntries.reduce((a, e) => a + e.amount, 0);
    const diff = roundCents(out.teamCanto - sum);
    if (diff > 0.01) {
      teamEntries.push({
        group: "team",
        label: "Diárias (outras)",
        amount: diff,
        category: "Mão de Obra",
      });
    }
  }
  if (out.otherExpenses !== null) {
    const sum = otherEntries.reduce((a, e) => a + e.amount, 0);
    const diff = roundCents(out.otherExpenses - sum);
    if (diff > 0.01) {
      otherEntries.push({
        group: "other",
        label: "Outros (não classificados)",
        amount: diff,
        category: "Outros",
      });
    }
  }

  out.entries = [...teamEntries, ...otherEntries];

  if (out.teamCanto === null) {
    out.warnings.push("Secção 'Equipe de campo' (ou equivalente) ou respectivo total não encontrada.");
  }
  if (out.otherExpenses === null) {
    out.warnings.push("Secção 'Demais despesas' ou respectivo total não encontrada.");
  }

  out.total = Math.max(0, (out.teamCanto ?? 0) + (out.otherExpenses ?? 0));
  void flat;
  return out;
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
