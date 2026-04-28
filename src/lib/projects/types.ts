/** Origem lógica do registro: Metabase (futuro) ou criação manual. */
export type ProjectSource = "metabase" | "manual";

/** Status do orçamento no processo gerencial. */
export type BudgetStatus = "missing" | "estimated" | "approved" | "closed" | "not_required";

/** Fase de vida do projeto. */
export type ProjectStatus = "future" | "active" | "finished" | "cancelled";

/** Escala de tamanho do projeto. */
export type ProjectSize = "PP" | "P" | "M" | "G" | "Mega" | "SuperMega" | "Unknown";

/** De onde vêm os números de orçamento no SGFO. */
export type BudgetSource = "none" | "manual" | "xlsx" | "sgfo";

/**
 * Entidade central do módulo Projetos (v3). Campos Metabase/resposta externa
 * vêm com `source === "metabase"`; enriquecimento e lanças manuais com `source === "manual"`.
 */
export type SGFOProject = {
  id: string;
  source: ProjectSource;
  /** Identificador lógico no Metabase, quando houver. */
  metabaseId?: string;
  contractId?: string;
  eventName: string;
  clientName?: string;
  city?: string;
  state?: string;
  eventDate?: string;
  endDate?: string;
  status: ProjectStatus;
  size: ProjectSize;
  responsible?: string;
  squad?: string;
  budgetStatus: BudgetStatus;
  budgetSource: BudgetSource;
  /** Orçamento no SGFO: import Excel / edição. Não importado do Metabase. */
  plannedCost?: number;
  /** Idem. */
  approvedCost?: number;
  /** Idem. */
  realizedCost?: number;
  notes?: string;
  /** ISO: última carga/linha vinda de integração (futuro). */
  importedAt?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsStore = {
  projects: SGFOProject[];
  lastSyncAt?: string;
  /** Contexto de UI: projeto em foco (ex.: detalhe futuro). */
  selectedProjectId?: string;
};

export const EMPTY_PROJECTS_STORE: ProjectsStore = {
  projects: [],
};

export type ProjectSummary = {
  totalProjects: number;
  futureProjects: number;
  activeProjects: number;
  finishedProjects: number;
  missingBudget: number;
  approvedBudget: number;
  estimatedBudget: number;
  totalPlannedCost: number;
  totalApprovedCost: number;
  totalRealizedCost: number;
};
