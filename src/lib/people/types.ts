/**
 * Pessoa (SGFO). Base a partir da aba `BD` + ajustes manuais. Pronta para Prisma.
 * Campos de planilha (BD) + derivações: zigTotalCost (temp. = currentSalary até cálculo Zig),
 * marketBenchmark, proposedSalary, squad (= filial quando veio só de BD), etc.
 */
export type PersonStatus = "Ativo" | "Afastado" | "Inativo";

export type Person = {
  id: string;
  name: string;
  role: string;
  squad: string;
  region: string;
  managerName: string;
  currentSalary: number;
  zigTotalCost: number;
  marketBenchmark: number;
  proposedSalary: number;
  freelanceAverage2025: number;
  status: PersonStatus;
  notes: string;
  /** Nota Comportamento (aba BD) */
  behaviorScore: number | null;
  /** Nota Entrega (aba BD) */
  deliveryScore: number | null;
  /** Classificação (aba BD) */
  classification: string;
  /** Mérito: null se "-" ou vazio */
  merit: string | null;
  /** Promoção (aba BD) */
  promotion: string;
  /** Talento (aba BD) */
  talent: string;
};

export const PERSON_STATUS: PersonStatus[] = ["Ativo", "Afastado", "Inativo"];

export function makePersonId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parseMoneyBRL(s: string): number | null {
  const t = s.replace(/\s/g, "").replace(/R\$/gi, "");
  if (!t) return null;
  const n = toNumberBRL(t);
  return n !== null && Number.isFinite(n) && n >= 0 ? n : null;
}

function toNumberBRL(t: string): number | null {
  const c = t.replace(/[^\d,.\-]/g, "");
  if (!c || c === "-" || c === "." || c === ",") return null;
  if (/^\d+(\.\d+)?$/.test(c) && c.indexOf(",") === -1) {
    return parseFloat(c);
  }
  const lastC = c.lastIndexOf(",");
  const lastD = c.lastIndexOf(".");
  if (lastC > lastD) {
    const w = c.slice(0, lastC).replace(/\./g, "");
    const dec = c.slice(lastC + 1);
    if (!/^\d+$/.test(dec)) return null;
    return parseFloat(`${w}.${dec}`);
  }
  if (lastD > lastC) {
    const w = c.slice(0, lastD).replace(/,/g, "");
    const dec = c.slice(lastD + 1);
    if (!/^\d+$/.test(dec)) return null;
    return parseFloat(`${w}.${dec}`);
  }
  if (c.includes(".") && !c.includes(",")) {
    return parseFloat(c);
  }
  if (c.includes(",") && !c.includes(".")) {
    if (/^\d+,\d{1,2}$/.test(c)) {
      return parseFloat(c.replace(",", "."));
    }
    return parseFloat(c.replace(/,/g, "")) || null;
  }
  const p = c.replace(/[^\d\-.]/g, "");
  if (!p) return null;
  return parseFloat(p);
}

export function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
