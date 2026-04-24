import * as XLSX from "xlsx";
import { makePersonId, type Person, normalizeHeader, parseMoneyBRL } from "./types";

/** Nome lógico da aba a ser lida (igual, ignorando caixa. Ex.: "BD" ou "bd") */
export const BD_SHEET_ID = "bd";

const REQUIRED: { key: BdKey; display: string; norms: string[] }[] = [
  { key: "name", display: "Colaborador", norms: ["colaborador"] },
  { key: "role", display: "Cargo", norms: ["cargo"] },
  { key: "region", display: "Filial", norms: ["filial"] },
  { key: "salary", display: "Salário Base", norms: ["salario base", "salário base"] },
  {
    key: "freelance",
    display: "Média Freelancer",
    norms: ["media freelancer", "média freelancer"],
  },
];

const OPTIONAL: { key: BdKey; display: string; norms: string[] }[] = [
  { key: "behavior", display: "Nota Comportamento", norms: ["nota comportamento"] },
  { key: "delivery", display: "Nota Entrega", norms: ["nota entrega"] },
  { key: "classification", display: "Classificação", norms: ["classificacao", "classificação"] },
  { key: "merit", display: "Mérito", norms: ["merito", "mérito"] },
  { key: "promotion", display: "Promoção", norms: ["promocao", "promoção"] },
  { key: "talent", display: "Talento", norms: ["talento"] },
];

type BdKey =
  | "name"
  | "role"
  | "region"
  | "salary"
  | "freelance"
  | "behavior"
  | "delivery"
  | "classification"
  | "merit"
  | "promotion"
  | "talent";

type FieldToOriginal = Partial<Record<BdKey, string>>;

export type BdRowOutcome = {
  excelRowIndex: number;
  errors: string[];
  person?: Person;
  preview: {
    colaborador: string;
    cargo: string;
    filial: string;
    salarioBase: string;
    mediaFreelancer: string;
    notaComportamento: string;
    notaEntrega: string;
    classificacao: string;
    merit: string;
    promocao: string;
    talento: string;
  };
};

export type BdImportStats = {
  totalPessoas: number;
  porFilial: { filial: string; count: number }[];
  custoSalarialTotal: number;
  mediaFreelancerMedia: number;
};

export type BdImportResult = {
  kind: "ok" | "no_sheet" | "missing_headers";
  message: string;
  missingColumns: string[];
  sheetName: string;
  headerLabels: string[];
  rowOutcomes: BdRowOutcome[];
  people: Person[];
  canConfirm: boolean;
  summary: string;
  stats: BdImportStats | null;
};

const empty = (): BdImportResult => ({
  kind: "ok",
  message: "Arquivo vazio.",
  missingColumns: [],
  sheetName: "",
  headerLabels: [],
  rowOutcomes: [],
  people: [],
  canConfirm: false,
  summary: "Arquivo vazio ou inválido.",
  stats: null,
});

/**
 * Lê **somente** a aba cujo nome (trim, case-insensitive) é `BD`. Ignora Parâmetros,
 * Resumo Executivo, Grupo A/B, etc.
 */
export function parseBdWorkbook(data: ArrayBuffer): BdImportResult {
  if (!data?.byteLength) {
    return empty();
  }
  const wb = XLSX.read(data, { type: "array" });
  const sheetRealName = wb.SheetNames.find(
    (n) => n.trim().toLowerCase() === BD_SHEET_ID
  );
  if (!sheetRealName) {
    return {
      kind: "no_sheet",
      message: "Aba BD não encontrada. Importação cancelada.",
      missingColumns: [],
      sheetName: "",
      headerLabels: [],
      rowOutcomes: [],
      people: [],
      canConfirm: false,
      summary: "Aba BD não encontrada. Importação cancelada.",
      stats: null,
    };
  }
  const sheet = wb.Sheets[sheetRealName];
  if (!sheet) {
    return {
      kind: "no_sheet",
      message: "Aba BD não encontrada. Importação cancelada.",
      missingColumns: [],
      sheetName: sheetRealName,
      headerLabels: [],
      rowOutcomes: [],
      people: [],
      canConfirm: false,
      summary: "Aba BD não encontrada. Importação cancelada.",
      stats: null,
    };
  }

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as
    | unknown[][]
    | null;
  const firstRow = aoa && aoa[0] ? aoa[0] : [];
  const headerLabels = firstRow.map((c) => String(c ?? "").trim());

  const fieldToOriginal = buildFieldToOriginal(firstRow);
  const missing: string[] = [];
  for (const r of REQUIRED) {
    if (!fieldToOriginal[r.key]) {
      missing.push(r.display);
    }
  }
  if (missing.length) {
    const s = `Faltam colunas obrigatórias (aba BD). Ausentes: ${missing.join(", ")}.`;
    return {
      kind: "missing_headers",
      message: s,
      missingColumns: missing,
      sheetName: sheetRealName,
      headerLabels,
      rowOutcomes: [],
      people: [],
      canConfirm: false,
      summary: s,
      stats: null,
    };
  }

  const objects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  const ft = fieldToOriginal as FieldToOriginal;

  const colaboradorKeys: { line: number; nKey: string }[] = [];
  for (let i = 0; i < objects.length; i++) {
    const p = readPreview(objects[i]!, ft);
    if (isRowCompletelyEmpty(p) || !p.colaborador.trim()) continue;
    colaboradorKeys.push({
      line: i + 2,
      nKey: normalizeName(p.colaborador),
    });
  }
  const cnt = new Map<string, number>();
  for (const c of colaboradorKeys) {
    cnt.set(c.nKey, (cnt.get(c.nKey) ?? 0) + 1);
  }
  const duplicateKeys = new Set<string>();
  for (const [k, c] of cnt) {
    if (c > 1) duplicateKeys.add(k);
  }

  const rowOutcomes: BdRowOutcome[] = [];

  for (let i = 0; i < objects.length; i++) {
    const excelRowIndex = i + 2;
    const p = readPreview(objects[i]!, ft);
    if (isRowCompletelyEmpty(p) || !p.colaborador.trim()) {
      continue;
    }
    const errors: string[] = [];
    const nKey = normalizeName(p.colaborador);
    if (duplicateKeys.has(nKey)) {
      errors.push(
        "Nome de colaborador duplicado na aba BD. Cada pessoa deve aparecer uma única linha. Não importamos duplicados automaticamente."
      );
    }

    const sal = parseMoneyBRL(p.salarioBase) ?? parseNumberExcel(p.salarioBase);
    if (sal === null) {
      errors.push("Salário Base: use um valor numérico (ex.: 5000, 5.000,00).");
    }
    const mfl = parseMoneyBRL(p.mediaFreelancer) ?? parseNumberExcel(p.mediaFreelancer);
    if (mfl === null) {
      errors.push("Média Freelancer: use um valor numérico (ex.: 2000, 2.000,00).");
    }
    if (!p.cargo.trim()) errors.push("Cargo: obrigatório na aba.");
    if (!p.filial.trim()) errors.push("Filial: obrigatório na aba.");

    let person: Person | undefined;
    if (errors.length === 0) {
      person = buildPersonFromBd(
        p,
        sal as number,
        mfl as number
      );
    }

    rowOutcomes.push({
      excelRowIndex,
      errors,
      person,
      preview: p,
    });
  }

  const withPerson: Person[] = rowOutcomes
    .map((o) => o.person)
    .filter((p): p is Person => p !== undefined);
  const statsPreview: BdImportStats | null =
    withPerson.length > 0 ? buildStats(withPerson) : null;

  const anyRowError = rowOutcomes.some((o) => o.errors.length > 0);
  const canConfirm = withPerson.length > 0 && !anyRowError;
  if (!canConfirm) {
    const reason = !rowOutcomes.length
      ? "Nenhuma linha com colaborador na aba BD."
      : anyRowError
        ? "Há erros de validação. Corrija a planilha (duplicatas, formatos, campos) e tente de novo."
        : "Não há pessoas válidas para importar.";

    return {
      kind: "ok",
      message: reason,
      missingColumns: [],
      sheetName: sheetRealName,
      headerLabels,
      rowOutcomes,
      people: [],
      canConfirm: false,
      summary: reason,
      /** Parcial: só linhas sem erros (útil com erros noutras linhas). */
      stats: statsPreview,
    };
  }

  return {
    kind: "ok",
    message: "Aba BD analisada com sucesso.",
    missingColumns: [],
    sheetName: sheetRealName,
    headerLabels,
    rowOutcomes,
    people: withPerson,
    canConfirm: true,
    summary: `Pronto para importar: ${withPerson.length} pessoa(s) da aba BD, sem erros.`,
    stats: statsPreview,
  };
}

function buildFieldToOriginal(headerRow: unknown[]): FieldToOriginal {
  const map: FieldToOriginal = {};
  const all = [...REQUIRED, ...OPTIONAL];
  for (const hRaw of headerRow) {
    const h = String(hRaw ?? "").trim();
    if (!h) continue;
    const hn = normalizeHeader(h);
    for (const spec of all) {
      if (map[spec.key]) continue;
      if (spec.norms.includes(hn)) {
        map[spec.key] = h;
        break;
      }
    }
  }
  return map;
}

function getCell(obj: Record<string, unknown>, key: string | undefined): string {
  if (!key) return "";
  if (!(key in obj)) return "";
  return cellToString((obj as Record<string, unknown>)[key]);
}

function readPreview(obj: Record<string, unknown>, f: FieldToOriginal): {
  colaborador: string;
  cargo: string;
  filial: string;
  salarioBase: string;
  mediaFreelancer: string;
  notaComportamento: string;
  notaEntrega: string;
  classificacao: string;
  merit: string;
  promocao: string;
  talento: string;
} {
  return {
    colaborador: getCell(obj, f.name),
    cargo: getCell(obj, f.role),
    filial: getCell(obj, f.region),
    salarioBase: getCell(obj, f.salary),
    mediaFreelancer: getCell(obj, f.freelance),
    notaComportamento: getCell(obj, f.behavior),
    notaEntrega: getCell(obj, f.delivery),
    classificacao: getCell(obj, f.classification),
    merit: getCell(obj, f.merit),
    promocao: getCell(obj, f.promotion),
    talento: getCell(obj, f.talent),
  };
}

function isRowCompletelyEmpty(p: ReturnType<typeof readPreview>): boolean {
  return !Object.values(p).some((v) => String(v).replace(/\s/g, "").length > 0);
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v);
  }
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function parseNumberExcel(s: string): number | null {
  const t = s.replace(/\s/g, "");
  if (!t || t === "—" || t === "-") return null;
  return parseMoneyBRL(s);
}

function parseMerit(s: string): string | null {
  const t = s.trim();
  if (!t || t === "—" || t === "-") return null;
  return t;
}

function parseOptionalScore(s: string): number | null {
  const t = s.trim();
  if (!t || t === "—" || t === "-") return null;
  if (t === "0" || t === "0,0" || t === "0.0") return 0;
  const n = parseNumberExcel(t);
  return n;
}

function buildPersonFromBd(
  p: ReturnType<typeof readPreview>,
  currentSalary: number,
  freelance: number
): Person {
  const name = p.colaborador.replace(/\s+/g, " ").trim();
  const filial = p.filial.trim();
  const behavior = parseOptionalScore(p.notaComportamento);
  const delivery = parseOptionalScore(p.notaEntrega);
  const merit = parseMerit(p.merit);
  return {
    id: makePersonId(),
    name,
    role: p.cargo.trim() || "—",
    squad: filial,
    region: filial,
    managerName: "",
    currentSalary,
    /** Temporário: alinhado ao salário base até cálculo Zig. */
    zigTotalCost: currentSalary,
    marketBenchmark: currentSalary,
    proposedSalary: currentSalary,
    freelanceAverage2025: Math.max(0, freelance),
    status: "Ativo",
    notes: "",
    behaviorScore: behavior,
    deliveryScore: delivery,
    classification: p.classificacao.trim() || "—",
    merit,
    promotion: p.promocao.trim() || "—",
    talent: p.talento.trim() || "—",
  };
}

function normalizeName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildStats(people: Person[]): BdImportStats {
  const por = new Map<string, number>();
  for (const p of people) {
    const f = p.region || "—";
    por.set(f, (por.get(f) ?? 0) + 1);
  }
  const arr = Array.from(por.entries())
    .map(([filial, count]) => ({ filial, count }))
    .sort((a, b) => b.count - a.count);
  const custo = people.reduce((s, p) => s + p.currentSalary, 0);
  const mMed =
    people.length > 0
      ? people.reduce((s, p) => s + p.freelanceAverage2025, 0) / people.length
      : 0;
  return {
    totalPessoas: people.length,
    porFilial: arr,
    custoSalarialTotal: custo,
    mediaFreelancerMedia: mMed,
  };
}
