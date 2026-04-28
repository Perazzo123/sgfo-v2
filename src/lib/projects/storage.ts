import { MOCK_PROJECTS } from "./mock";
import { mergeMetabaseWithLocal } from "./metabaseSync";
import { EMPTY_PROJECTS_STORE, type ProjectsStore, type SGFOProject } from "./types";

const STORE_KEY = "sgfo.projects.v1";

const ALL_BUDGET: SGFOProject["budgetStatus"][] = [
  "missing",
  "estimated",
  "approved",
  "closed",
  "not_required",
];
const ALL_BUDGET_SRC: SGFOProject["budgetSource"][] = ["none", "manual", "xlsx", "sgfo"];
const ALL_STATUS: SGFOProject["status"][] = ["future", "active", "finished", "cancelled"];
const ALL_SIZE: SGFOProject["size"][] = [
  "PP",
  "P",
  "M",
  "G",
  "Mega",
  "SuperMega",
  "Unknown",
];

function pickBudgetStatus(x: unknown): SGFOProject["budgetStatus"] {
  return typeof x === "string" && ALL_BUDGET.includes(x as SGFOProject["budgetStatus"])
    ? (x as SGFOProject["budgetStatus"])
    : "missing";
}
function pickBudgetSource(x: unknown): SGFOProject["budgetSource"] {
  return typeof x === "string" && ALL_BUDGET_SRC.includes(x as SGFOProject["budgetSource"])
    ? (x as SGFOProject["budgetSource"])
    : "none";
}
function pickStatus(x: unknown): SGFOProject["status"] {
  return typeof x === "string" && ALL_STATUS.includes(x as SGFOProject["status"])
    ? (x as SGFOProject["status"])
    : "active";
}
function pickSize(x: unknown): SGFOProject["size"] {
  return typeof x === "string" && ALL_SIZE.includes(x as SGFOProject["size"])
    ? (x as SGFOProject["size"])
    : "Unknown";
}

function numOrUndef(x: unknown): number | undefined {
  if (x == null) return undefined;
  const n = Number(x);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function normalizeProject(p: unknown): SGFOProject | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  const t = new Date().toISOString();
  return {
    id: o.id.trim(),
    source: o.source === "manual" ? "manual" : "metabase",
    metabaseId: typeof o.metabaseId === "string" ? o.metabaseId : undefined,
    contractId: typeof o.contractId === "string" ? o.contractId : undefined,
    eventName: typeof o.eventName === "string" && o.eventName ? o.eventName : "(sem nome)",
    clientName: typeof o.clientName === "string" ? o.clientName : undefined,
    city: typeof o.city === "string" ? o.city : undefined,
    state: typeof o.state === "string" ? o.state : undefined,
    eventDate: typeof o.eventDate === "string" ? o.eventDate : undefined,
    endDate: typeof o.endDate === "string" ? o.endDate : undefined,
    status: pickStatus(o.status),
    size: pickSize(o.size),
    responsible: typeof o.responsible === "string" ? o.responsible : undefined,
    squad: typeof o.squad === "string" ? o.squad : undefined,
    budgetStatus: pickBudgetStatus(o.budgetStatus),
    budgetSource: pickBudgetSource(o.budgetSource),
    plannedCost: numOrUndef(o.plannedCost),
    approvedCost: numOrUndef(o.approvedCost),
    realizedCost: numOrUndef(o.realizedCost),
    notes: typeof o.notes === "string" ? o.notes : undefined,
    importedAt: typeof o.importedAt === "string" ? o.importedAt : undefined,
    lastSyncedAt: typeof o.lastSyncedAt === "string" ? o.lastSyncedAt : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : t,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : t,
  };
}

function normalizeStore(raw: unknown): ProjectsStore {
  if (!raw || typeof raw !== "object")
    return { ...EMPTY_PROJECTS_STORE };
  const o = raw as Record<string, unknown>;
  const list = o.projects;
  if (!Array.isArray(list)) return { ...EMPTY_PROJECTS_STORE };
  const projects: SGFOProject[] = list
    .map(normalizeProject)
    .filter((x): x is SGFOProject => x !== null);
  return {
    projects,
    lastSyncAt: typeof o.lastSyncAt === "string" ? o.lastSyncAt : undefined,
    selectedProjectId: typeof o.selectedProjectId === "string" ? o.selectedProjectId : undefined,
  };
}

export function getProjectsStore(): ProjectsStore {
  if (typeof window === "undefined") return { ...EMPTY_PROJECTS_STORE };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { ...EMPTY_PROJECTS_STORE };
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY_PROJECTS_STORE };
  }
}

export function saveProjectsStore(store: ProjectsStore): void {
  if (typeof window === "undefined") return;
  const payload: ProjectsStore = {
    ...store,
    projects: [...store.projects],
  };
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch {
    /* no-op */
  }
}

export function getProjects(): SGFOProject[] {
  return getProjectsStore().projects;
}

export function saveProjects(projects: SGFOProject[]): void {
  const s = getProjectsStore();
  saveProjectsStore({ ...s, projects: [...projects] });
}

/**
 * Cria ou substitui o projeto com o mesmo `id`.
 */
export function upsertProject(project: SGFOProject): void {
  const s = getProjectsStore();
  const i = s.projects.findIndex((p) => p.id === project.id);
  const now = new Date().toISOString();
  const next: SGFOProject = {
    ...project,
    updatedAt: now,
    createdAt: i >= 0 ? s.projects[i].createdAt : project.createdAt,
  };
  if (i >= 0) {
    const list = s.projects.map((p, j) => (j === i ? next : p));
    saveProjectsStore({ ...s, projects: list });
  } else {
    const t0 = project.createdAt && project.createdAt.trim() ? project.createdAt : now;
    const created: SGFOProject = { ...next, createdAt: t0 };
    saveProjectsStore({ ...s, projects: [...s.projects, created] });
  }
}

export function updateProject(
  projectId: string,
  patch: Partial<Omit<SGFOProject, "id" | "createdAt">>
): void {
  const s = getProjectsStore();
  const now = new Date().toISOString();
  const next = s.projects.map((p) => {
    if (p.id !== projectId) return p;
    return {
      ...p,
      ...patch,
      id: p.id,
      createdAt: p.createdAt,
      updatedAt: now,
    };
  });
  if (!next.find((p) => p.id === projectId)) return;
  saveProjectsStore({ ...s, projects: next });
}

export function deleteProject(projectId: string): void {
  const s = getProjectsStore();
  saveProjectsStore({
    ...s,
    projects: s.projects.filter((p) => p.id !== projectId),
  });
}

/**
 * Insere os mocks cujo `id` ainda não existe, sem duplicar.
 */
export function seedMockProjectsIfEmpty(): { added: number; total: number } {
  const s = getProjectsStore();
  const byId = new Set(s.projects.map((p) => p.id));
  const toAdd: SGFOProject[] = [];
  for (const m of MOCK_PROJECTS) {
    if (!byId.has(m.id)) toAdd.push(m);
  }
  if (toAdd.length === 0) return { added: 0, total: s.projects.length };
  saveProjectsStore({ ...s, projects: [...s.projects, ...toAdd] });
  return { added: toAdd.length, total: s.projects.length + toAdd.length };
}

/**
 * Sincroniza tudo o que o card do Metabase devolve (filtrar período no Metabase, não aqui).
 * Orçamento: só o que existir no SGFO (nunca Metabase).
 */
export function applyMetabaseSync(
  incoming: SGFOProject[],
  syncedAt: string
):
  | { success: true }
  | { success: false; reason: "empty_sync" } {
  const s = getProjectsStore();
  const m = mergeMetabaseWithLocal(s.projects, incoming, syncedAt);
  if (m.skipped) {
    return { success: false, reason: "empty_sync" };
  }
  saveProjectsStore({ ...s, projects: m.projects, lastSyncAt: m.lastSyncAt });
  return { success: true };
}
