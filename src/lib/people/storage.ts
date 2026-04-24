import {
  makePersonId,
  type Person,
} from "./types";

const PEOPLE_KEY = "sgfo.people.v1";
const IMPORT_KEY = "sgfo.people.importOnboarding";
const LAST_IMPORT_KEY = "sgfo.people.lastImportAt";

export function isImportComplete(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(IMPORT_KEY) === "1";
  } catch {
    return false;
  }
}

export function getLastImportAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_IMPORT_KEY);
  } catch {
    return null;
  }
}

export function markImportComplete(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IMPORT_KEY, "1");
    window.localStorage.setItem(LAST_IMPORT_KEY, new Date().toISOString());
  } catch {
    /* no-op */
  }
}

/**
 * Lê a base persistida (estado local). Failsafe: array vazio se JSON corrompido.
 */
export function loadPeopleFromStorage(): Person[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PEOPLE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(migrateFromSaved)
      .filter((p): p is Person => p !== null);
  } catch {
    return [];
  }
}

export function savePeopleToStorage(people: Person[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
  } catch {
    /* no-op */
  }
}

/**
 * Grava a base a partir de importação (substitui tudo) e dispara o fluxo “uma vez”.
 */
export function replaceWithImportedPeople(people: Person[]): void {
  savePeopleToStorage(people);
  markImportComplete();
}

function migrateFromSaved(row: unknown): Person | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) return null;

  const id =
    typeof o.id === "string" && o.id
      ? o.id
      : o.id != null
        ? String(o.id)
        : makePersonId();

  const status =
    o.status === "Ativo" || o.status === "Afastado" || o.status === "Inativo"
      ? o.status
      : "Inativo";

  return {
    id,
    name: o.name,
    role: String(o.role ?? "—"),
    squad: String(o.squad ?? "—"),
    region: String(o.region ?? ""),
    managerName: String(o.managerName ?? ""),
    currentSalary: toNum(o.currentSalary) ?? 0,
    zigTotalCost: toNum(o.zigTotalCost) ?? toNum(o.currentSalary) ?? 0,
    marketBenchmark: toNum(o.marketBenchmark) ?? toNum(o.currentSalary) ?? 0,
    proposedSalary: toNum(o.proposedSalary) ?? toNum(o.currentSalary) ?? 0,
    freelanceAverage2025: toNum(o.freelanceAverage2025) ?? 0,
    status,
    notes: String(o.notes ?? ""),
    behaviorScore: toNumNull(o.behaviorScore),
    deliveryScore: toNumNull(o.deliveryScore),
    classification: String(o.classification ?? "—"),
    merit:
      o.merit === null || o.merit === undefined
        ? null
        : String(o.merit) === "" || o.merit === "-"
          ? null
          : String(o.merit),
    promotion: String(o.promotion ?? "—"),
    talent: String(o.talent ?? "—"),
  };
}

function toNumNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (v === "" || v === "-") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
