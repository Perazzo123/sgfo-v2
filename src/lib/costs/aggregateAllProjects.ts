import type { ProjectsStore } from "./types";

/**
 * Soma orçamento previsto e custos realizados de **todos** os projetos no store
 * (ativos e encerrados), para visão consolidada no dashboard.
 */
export function aggregateAllProjectsCostMetrics(store: ProjectsStore): {
  projectCount: number;
  previstoTotal: number;
  realizadoTotal: number;
  entriesCount: number;
  /** previstoTotal − realizadoTotal (positivo = saldo a favor; negativo = estouro). */
  bolsao: number;
  /** realizado / previsto · 100 (0 se previsto = 0). */
  pctExec: number;
} {
  const projects = store.projects;
  let previstoTotal = 0;
  let realizadoTotal = 0;
  let entriesCount = 0;
  for (const p of projects) {
    previstoTotal += Number(p.budget?.total) || 0;
    for (const e of p.entries ?? []) {
      realizadoTotal += Number(e.amount) || 0;
      entriesCount += 1;
    }
  }
  const bolsao = previstoTotal - realizadoTotal;
  const pctExec = previstoTotal > 0 ? (realizadoTotal / previstoTotal) * 100 : 0;
  return {
    projectCount: projects.length,
    previstoTotal,
    realizadoTotal,
    entriesCount,
    bolsao,
    pctExec,
  };
}
