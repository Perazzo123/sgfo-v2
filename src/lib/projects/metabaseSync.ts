import type { SGFOProject } from "./types";

/**
 * Mistura a lista vinda do Metabase com a base local, preservando enriquecimentos
 * (responsável, orçamento SGFO, notas) quando o utilizador já os definiu.
 *
 * - Todos os projetos `source === "manual"` são mantidos.
 * - Cada evento vindo do Metabase substitui o antigo com o mesmo `metabaseId`.
 * - Dados "de evento" vêm do payload; **orçamento** (valores, status, origem) não
 *   vêm do Metabase — conserva-se o que o utilizador importou/editou no SGFO
 *   (p.ex. Excel), nunca a linha de API.
 */
export type MetabaseMergeResult = {
  projects: SGFOProject[];
  lastSyncAt?: string;
  /** Carga vazia: não altera o que já existe (evita apagar projetos Metabase por resposta 0-linhas). */
  skipped: boolean;
  skipReason?: "empty";
};

export function mergeMetabaseWithLocal(
  current: SGFOProject[],
  fromApi: SGFOProject[],
  syncIso: string
): MetabaseMergeResult {
  const manual = current.filter((p) => p.source === "manual");
  const hasLocalMetabase = current.some(
    (p) => p.source === "metabase" && p.metabaseId
  );
  if (fromApi.length === 0) {
    if (hasLocalMetabase) {
      return {
        projects: current,
        lastSyncAt: undefined,
        skipped: true,
        skipReason: "empty",
      };
    }
    return {
      projects: manual,
      lastSyncAt: syncIso,
      skipped: false,
    };
  }

  const byMb = new Map<string, SGFOProject>();
  for (const p of current) {
    if (p.source === "metabase" && p.metabaseId) {
      byMb.set(p.metabaseId, p);
    }
  }

  const out: SGFOProject[] = [];
  for (const api of fromApi) {
    if (!api.metabaseId) continue;
    const ex = byMb.get(api.metabaseId);
    const now = new Date().toISOString();
    if (!ex) {
      out.push({
        ...api,
        lastSyncedAt: syncIso,
        updatedAt: now,
        createdAt: api.createdAt || now,
      });
      continue;
    }
    out.push(mergeOne(ex, api, syncIso, now));
  }

  return { projects: [...manual, ...out], lastSyncAt: syncIso, skipped: false };
}

function mergeOne(
  ex: SGFOProject,
  api: SGFOProject,
  syncIso: string,
  now: string
): SGFOProject {
  const pickStr = (a: string | undefined, b: string | undefined) =>
    a != null && a !== "" && a.trim() !== "" ? a : b;

  return {
    ...api,
    id: ex.id,
    source: "metabase",
    metabaseId: api.metabaseId,
    createdAt: ex.createdAt,
    updatedAt: now,
    lastSyncedAt: syncIso,
    importedAt: api.importedAt,
    eventName: api.eventName,
    clientName: api.clientName,
    city: api.city,
    state: api.state,
    eventDate: api.eventDate,
    endDate: api.endDate,
    contractId: api.contractId,
    status: api.status,
    size: ex.size && ex.size !== "Unknown" ? ex.size : api.size,
    responsible: pickStr(ex.responsible, api.responsible),
    squad: pickStr(ex.squad, api.squad),
    // Orçamento: só o que já existe no SGFO (nunca a linha da API, que não traz orçamento).
    budgetStatus: ex.budgetStatus,
    budgetSource: ex.budgetSource,
    plannedCost: ex.plannedCost,
    approvedCost: ex.approvedCost,
    realizedCost: ex.realizedCost,
    notes: pickStr(ex.notes, api.notes),
  };
}
