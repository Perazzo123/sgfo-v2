import {
  EMPTY_BUDGET,
  EMPTY_PROJECTS_STORE,
  makeProjectId,
  type Budget,
  type CostEntry,
  type Project,
  type ProjectsStore,
} from "./types";

const PROJECTS_KEY = "sgfo.costs.projects.v1";
// Chaves antigas (mantidas só para migração one-shot).
const LEGACY_BUDGET_KEY = "sgfo.costs.budget.v1";
const LEGACY_ENTRIES_KEY = "sgfo.costs.entries.v1";

function normalizeBudget(b: Partial<Budget> | null | undefined): Budget {
  return {
    ...EMPTY_BUDGET,
    ...(b ?? {}),
    breakdown: (b?.breakdown ?? {}) as Budget["breakdown"],
  } as Budget;
}

function normalizeEntries(raw: unknown): CostEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): CostEntry | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const amount = Number(o.amount);
      if (!Number.isFinite(amount)) return null;
      const entry: CostEntry = {
        id: String(o.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
        category: String(o.category ?? "Outros"),
        description: String(o.description ?? ""),
        amount,
        justification: String(o.justification ?? ""),
        createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
      };
      if (o.outsideBudget === true) entry.outsideBudget = true;
      return entry;
    })
    .filter((x): x is CostEntry => x !== null);
}

function normalizeProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Project>;
  const id = typeof p.id === "string" ? p.id : "";
  if (!id) return null;
  return {
    id,
    budget: normalizeBudget(p.budget),
    entries: normalizeEntries(p.entries),
    status: p.status === "closed" ? "closed" : "open",
    closedAt: typeof p.closedAt === "string" ? p.closedAt : undefined,
  };
}

function readLegacy(): { budget: Budget | null; entries: CostEntry[] } {
  if (typeof window === "undefined") return { budget: null, entries: [] };
  let budget: Budget | null = null;
  let entries: CostEntry[] = [];
  try {
    const rawB = window.localStorage.getItem(LEGACY_BUDGET_KEY);
    if (rawB) {
      const parsed = JSON.parse(rawB);
      if (parsed && typeof parsed === "object") budget = normalizeBudget(parsed);
    }
  } catch {
    /* no-op */
  }
  try {
    const rawE = window.localStorage.getItem(LEGACY_ENTRIES_KEY);
    if (rawE) entries = normalizeEntries(JSON.parse(rawE));
  } catch {
    /* no-op */
  }
  return { budget, entries };
}

function migrateLegacyToStore(): ProjectsStore | null {
  const { budget, entries } = readLegacy();
  if (!budget && entries.length === 0) return null;
  const b = budget ?? EMPTY_BUDGET;
  const id = makeProjectId({ contractId: b.contractId, eventName: b.eventName }) || "projeto-legado";
  const project: Project = {
    id,
    budget: b,
    entries,
    status: "open",
  };
  return { projects: [project], activeProjectId: id };
}

export function loadProjectsStore(): ProjectsStore {
  if (typeof window === "undefined") return { ...EMPTY_PROJECTS_STORE };
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProjectsStore>;
      if (parsed && Array.isArray(parsed.projects)) {
        const projects: Project[] = parsed.projects
          .map((p) => normalizeProject(p))
          .filter((p): p is Project => p !== null);
        const firstOpen = projects.find((p) => p.status === "open") ?? null;
        const activeProjectId =
          typeof parsed.activeProjectId === "string" &&
          projects.some(
            (p) => p.id === parsed.activeProjectId && p.status === "open"
          )
            ? parsed.activeProjectId
            : (firstOpen?.id ?? null);
        return { projects, activeProjectId };
      }
    }
  } catch {
    /* no-op */
  }
  // Sem dados no novo formato: tenta migrar.
  const migrated = migrateLegacyToStore();
  if (migrated) {
    saveProjectsStore(migrated);
    // Limpa as chaves legadas para evitar confusão futura.
    try {
      window.localStorage.removeItem(LEGACY_BUDGET_KEY);
      window.localStorage.removeItem(LEGACY_ENTRIES_KEY);
    } catch {
      /* no-op */
    }
    return migrated;
  }
  return { ...EMPTY_PROJECTS_STORE };
}

export function saveProjectsStore(store: ProjectsStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(store));
  } catch {
    /* no-op */
  }
}

/**
 * Insere ou atualiza um projeto. Quando atualiza, **mantém os lançamentos
 * existentes** e sobrescreve apenas o budget (que vem do Excel).
 * Retorna o store atualizado.
 */
export function upsertProject(
  store: ProjectsStore,
  project: {
    id: string;
    budget: Budget;
    entries?: CostEntry[];
    status?: Project["status"];
    closedAt?: string;
  }
): ProjectsStore {
  const idx = store.projects.findIndex((p) => p.id === project.id);
  let next: Project[];
  if (idx >= 0) {
    const prev = store.projects[idx];
    next = [...store.projects];
    next[idx] = {
      ...prev,
      budget: project.budget,
      entries: project.entries ?? prev.entries,
      status: project.status ?? prev.status,
      closedAt: project.closedAt ?? prev.closedAt,
    };
  } else {
    next = [
      ...store.projects,
      {
        id: project.id,
        budget: project.budget,
        entries: project.entries ?? [],
        status: project.status ?? "open",
        closedAt: project.closedAt,
      },
    ];
  }
  const activeProjectId =
    (next.find((p) => p.id === project.id)?.status ?? "open") === "open"
      ? project.id
      : store.activeProjectId;
  return { projects: next, activeProjectId };
}

export function removeProject(store: ProjectsStore, id: string): ProjectsStore {
  const projects = store.projects.filter((p) => p.id !== id);
  const activeProjectId =
    store.activeProjectId === id ? (projects[0]?.id ?? null) : store.activeProjectId;
  return { projects, activeProjectId };
}

export function setActiveProject(store: ProjectsStore, id: string | null): ProjectsStore {
  if (id !== null && !store.projects.some((p) => p.id === id && p.status === "open")) return store;
  return { ...store, activeProjectId: id };
}

export function getActiveProject(store: ProjectsStore | null): Project | null {
  if (!store) return null;
  return store.projects.find((p) => p.id === store.activeProjectId && p.status === "open") ?? null;
}

export function closeProject(store: ProjectsStore, id: string): ProjectsStore {
  const now = new Date().toISOString();
  const projects: Project[] = store.projects.map((p): Project =>
    p.id === id ? { ...p, status: "closed", closedAt: now } : p
  );
  const nextActive =
    projects.find((p) => p.status === "open" && p.id !== id)?.id ??
    projects.find((p) => p.status === "open")?.id ??
    null;
  return { projects, activeProjectId: nextActive };
}

export function reopenProject(store: ProjectsStore, id: string): ProjectsStore {
  const projects: Project[] = store.projects.map((p): Project =>
    p.id === id ? { ...p, status: "open", closedAt: undefined } : p
  );
  const reopened = projects.find((p) => p.id === id && p.status === "open") ?? null;
  return { projects, activeProjectId: reopened?.id ?? store.activeProjectId };
}
