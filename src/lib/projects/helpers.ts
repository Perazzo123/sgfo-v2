import { hasEventInYmdRange } from "./isoWeek";
import type { BudgetStatus, ProjectSize, ProjectStatus, SGFOProject, ProjectSummary } from "./types";

const SIZE_WEIGHT: Record<ProjectSize, number> = {
  PP: 1,
  P: 2,
  M: 3,
  G: 4,
  Mega: 5,
  SuperMega: 6,
  Unknown: 0,
};

const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  missing: "Sem orçamento",
  estimated: "Estimado",
  approved: "Aprovado",
  closed: "Encerrado",
  not_required: "Não aplica",
};

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  future: "Futuro",
  active: "Ativo",
  finished: "Concluído",
  cancelled: "Cancelado",
};

function slugPart(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * Gera id estável a partir de identificadores externos; fallback para id manual único.
 */
export function makeProjectId(project: {
  source?: "metabase" | "manual";
  metabaseId?: string;
  contractId?: string;
  eventName?: string;
}): string {
  if (project.metabaseId) return `mb-${project.metabaseId}`;
  const c = (project.contractId || "").trim();
  if (c) return `ct-${slugPart(c) || c}`;
  return `man-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatCurrency(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Aceita ISO ou string de data; devolve exibição em pt-BR. */
export function formatDate(date: string | undefined | null): string {
  if (!date || !String(date).trim()) return "—";
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  return String(date);
}

export function getBudgetStatusLabel(status: BudgetStatus): string {
  return BUDGET_STATUS_LABEL[status] ?? status;
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABEL[status] ?? status;
}

export function getProjectSizeWeight(size: ProjectSize): number {
  return SIZE_WEIGHT[size] ?? 0;
}

/**
 * O Metabase traz só dados de evento (quantidade por filtro de data); orçamento existe
 * apenas no SGFO (planilha, edição). Usado para o match eventos vs orçamento.
 */
export function projectHasSgfoBudget(p: SGFOProject): boolean {
  if (p.budgetStatus !== "missing") return true;
  if (typeof p.plannedCost === "number" && Number.isFinite(p.plannedCost)) return true;
  if (typeof p.approvedCost === "number" && Number.isFinite(p.approvedCost)) return true;
  if (typeof p.realizedCost === "number" && Number.isFinite(p.realizedCost)) return true;
  if (p.budgetSource && p.budgetSource !== "none") return true;
  return false;
}

export type DateRangeProjectsVsBudget = {
  from: string;
  to: string;
  eventsInRange: number;
  withBudgetInRange: number;
};

/**
 * Match no mesmo intervalo do sync (entre duas datas, inclusive), vs orçamento no SGFO.
 */
export function matchDateRangeProjectsVsBudget(
  projects: SGFOProject[],
  from: string,
  to: string
): DateRangeProjectsVsBudget {
  const inR = projects.filter((p) => hasEventInYmdRange(p.eventDate, from, to));
  const withB = inR.filter(projectHasSgfoBudget);
  return { from, to, eventsInRange: inR.length, withBudgetInRange: withB.length };
}

export function calculateProjectSummary(projects: SGFOProject[]): ProjectSummary {
  let futureProjects = 0;
  let activeProjects = 0;
  let finishedProjects = 0;
  let missingBudget = 0;
  let approvedBudget = 0;
  let estimatedBudget = 0;
  let totalPlannedCost = 0;
  let totalApprovedCost = 0;
  let totalRealizedCost = 0;

  for (const p of projects) {
    if (p.status === "future") futureProjects += 1;
    if (p.status === "active") activeProjects += 1;
    if (p.status === "finished") finishedProjects += 1;
    if (p.budgetStatus === "missing") missingBudget += 1;
    if (p.budgetStatus === "approved") approvedBudget += 1;
    if (p.budgetStatus === "estimated") estimatedBudget += 1;
    if (typeof p.plannedCost === "number" && Number.isFinite(p.plannedCost)) {
      totalPlannedCost += p.plannedCost;
    }
    if (typeof p.approvedCost === "number" && Number.isFinite(p.approvedCost)) {
      totalApprovedCost += p.approvedCost;
    }
    if (typeof p.realizedCost === "number" && Number.isFinite(p.realizedCost)) {
      totalRealizedCost += p.realizedCost;
    }
  }

  return {
    totalProjects: projects.length,
    futureProjects,
    activeProjects,
    finishedProjects,
    missingBudget,
    approvedBudget,
    estimatedBudget,
    totalPlannedCost,
    totalApprovedCost,
    totalRealizedCost,
  };
}
