/**
 * Orçamento (budget) carregado a partir de um documento ou input manual.
 * `total` define o teto utilizado para o projeto (previsto).
 */
export type BudgetCategoryKey =
  | "maoDeObra"
  | "transporte"
  | "hospedagem"
  | "alimentacao"
  | "frete"
  | "outros";

export type BudgetBreakdown = Partial<Record<BudgetCategoryKey, number>>;

export type Budget = {
  /** Nome do evento/projeto. */
  eventName: string;
  /** Identificador externo (ex.: nº do contrato). */
  contractId: string;
  /** Datas livres (string para evitar parsers regionais). */
  startDate: string;
  endDate: string;
  /** Local / endereço. */
  location: string;
  /** Total considerado como teto do orçamento (R$). Este é o "Previsto". */
  total: number;
  /** Quebra opcional por categoria. */
  breakdown: BudgetBreakdown;
  /** Origem do dado: input manual, planilha Excel importada, etc. */
  source: "manual" | "xlsx";
  /** ISO da última atualização. */
  updatedAt: string;
  /** Nome do arquivo importado (quando source = xlsx). */
  fileName?: string;
  /** Aba do Excel de onde o total foi extraído (quando source = xlsx). */
  sourceSheet?: string;
};

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategoryKey, string> = {
  maoDeObra: "Mão de Obra",
  transporte: "Transporte",
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  frete: "Frete",
  outros: "Outros",
};

export const EMPTY_BUDGET: Budget = {
  eventName: "",
  contractId: "",
  startDate: "",
  endDate: "",
  location: "",
  total: 0,
  breakdown: {},
  source: "manual",
  updatedAt: "",
};

/**
 * Lançamento de custo realizado dentro de um projeto.
 * O somatório dos `amount` representa o "Realizado" do projeto.
 */
export type CostEntry = {
  id: string;
  category: string;
  description: string;
  amount: number;
  justification: string;
  /** ISO de criação. */
  createdAt: string;
};

/**
 * Um projeto encapsula um orçamento (previsto) e seus lançamentos (realizado).
 * Cada importação de Excel cria/atualiza um projeto identificado pelo `id`
 * (preferencialmente derivado do número de contrato).
 */
export type Project = {
  /** Identificador estável do projeto (slug do contractId ou eventName). */
  id: string;
  /** Orçamento previsto. */
  budget: Budget;
  /** Lançamentos de custos realizados. */
  entries: CostEntry[];
  /** Aberto = em execução; fechado = consolidado em tabela histórica. */
  status: "open" | "closed";
  /** ISO de quando o orçamento foi encerrado. */
  closedAt?: string;
};

export type ProjectsStore = {
  projects: Project[];
  /** Projeto atualmente selecionado na UI. */
  activeProjectId: string | null;
};

export const EMPTY_PROJECTS_STORE: ProjectsStore = {
  projects: [],
  activeProjectId: null,
};

/**
 * Gera um id estável para um projeto a partir do contractId (preferido)
 * ou do nome do evento. Sempre normalizado para slug ascii.
 */
export function makeProjectId(input: { contractId?: string; eventName?: string }): string {
  const base = (input.contractId || input.eventName || "").trim();
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (slug) return slug;
  // Fallback: timestamp + random.
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
