/** Chaves do backlog (v2 = atual; v1 = legado, ainda lido no fallback). */
export const SGFO_BACKLOG_LS_V1 = "sgfo.backlog.items.v1";
export const SGFO_BACKLOG_LS_V2 = "sgfo.backlog.items.v2";

/**
 * Lê o array de itens: tenta v2, depois v1 (migrar para v2 fica a cargo da página Backlog no primeiro acesso).
 */
export function readBacklogItemsFromLocalStorage<T>(): T[] {
  if (typeof window === "undefined") return [];
  try {
    const v2 = window.localStorage.getItem(SGFO_BACKLOG_LS_V2);
    if (v2) return JSON.parse(v2) as T[];
    const v1 = window.localStorage.getItem(SGFO_BACKLOG_LS_V1);
    if (v1) return JSON.parse(v1) as T[];
  } catch { /* no-op */ }
  return [];
}
