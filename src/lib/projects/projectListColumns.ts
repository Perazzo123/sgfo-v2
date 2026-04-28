/**
 * Cabeçalhos da listagem de projetos: mesma ordem/semântica do card no Metabase
 * (ID, OS, EVENTO, CLIENTE, INÍCIO, FIM, CIDADE, UF, STATUS, TAMANHO, RESPONSÁVEL, SQUAD),
 * com o acréscimo das colunas de orçamento no SGFO: PREVISTO, APROVADO, REALIZADO, STATUS ORÇ.
 * ORIGEM e AÇÕES são só interface.
 */
export const PROJECT_LIST_HEADERS = [
  { key: "metabaseId", label: "ID" },
  { key: "contractId", label: "OS" },
  { key: "eventName", label: "EVENTO" },
  { key: "clientName", label: "CLIENTE" },
  { key: "eventDate", label: "INÍCIO" },
  { key: "endDate", label: "FIM" },
  { key: "city", label: "CIDADE" },
  { key: "state", label: "UF" },
  { key: "status", label: "STATUS" },
  { key: "size", label: "TAMANHO" },
  { key: "responsible", label: "RESPONSÁVEL" },
  { key: "squad", label: "SQUAD" },
  { key: "plannedCost", label: "PREVISTO", align: "right" as const },
  { key: "approvedCost", label: "APROVADO", align: "right" as const },
  { key: "realizedCost", label: "REALIZADO", align: "right" as const },
  { key: "budgetStatus", label: "STATUS ORÇ." },
  { key: "source", label: "ORIGEM" },
  { key: "actions", label: "AÇÕES" },
] as const;

export type ProjectListHeaderKey = (typeof PROJECT_LIST_HEADERS)[number]["key"];

/** Chaves de dados (linha da tabela) — exclui AÇÕES. */
export type ProjectListDataKey = Exclude<ProjectListHeaderKey, "actions">;
