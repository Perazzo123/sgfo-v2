import { makeProjectId } from "./helpers";
import { orderDateRange } from "./isoWeek";
import type { ProjectSize, ProjectStatus, SGFOProject } from "./types";

const STATUS_BY_TOKEN: { test: (s: string) => boolean; v: ProjectStatus }[] = [
  { v: "future", test: (s) => /futur|agend|planej|pend/i.test(s) },
  { v: "active", test: (s) => /ativ|em\s*and|execu|on\s*goin|current/i.test(s) },
  { v: "finished", test: (s) => /conclu|fina|encerr|done|entreg|realiz\w*\s*$/i.test(s) },
  { v: "cancelled", test: (s) => /cancel|suspens/i.test(s) },
];

const SIZES: ProjectSize[] = [
  "PP",
  "P",
  "M",
  "G",
  "Mega",
  "SuperMega",
  "Unknown",
];

/**
 * Nomes de coluna (case-insensitive) possíveis para o ID estável vindo do Metabase.
 * Deve ser único por evento. Obrigatório para upsert; senão a linha é ignorada.
 */
const COL_METABASE_ID = [
  "task_id",
  "clickup",
  "id",
  "id_evento",
  "id_event",
  "metabase_id",
  "id_metabase",
  "pk",
  "cod_evento",
  "codigo_evento",
  "cod",
];

const COL_EVENT: string[] = [
  "evento",
  "event_name",
  "nome_evento",
  "name",
  "titulo",
  "título",
  "descricao",
];

const COL_CLIENT: string[] = [
  "cliente",
  "client_name",
  "cliente_nome",
  "empresa",
  "org",
  "razaosocial",
];

const COL_CITY: string[] = ["cidade", "city", "municipio", "município"];
const COL_UF: string[] = ["uf", "estado", "state", "sigla_estado"];
const COL_DATE: string[] = [
  // Datas reais de início do evento — maior prioridade
  "inicio",
  "data_inicio",
  "datainicio",
  "início",
  "data_de_inicio",
  "data_de_início",
  "dt_go_live",
  "data_evento",
  "event_date",
  "dt_evento",
  "data_do_evento",
  "data",
  "dt",
  "data_prevista",
  "data_realizacao",
  "data_realização",
  "dt_previsto",
  "dt_realizacao",
  "date",
  // Rótulo textual — só fallback
  "semana",
];
const COL_END_DATE: string[] = [
  "fim",
  "data_fim",
  "end_date",
  "dt_fim",
  "termino",
  "término",
  "data_termino",
  "data_término",
  "encerramento",
  "data_encerramento",
  "data_final",
];

const COL_CONTRACT: string[] = [
  "contrato",
  "contract_id",
  "n_contrato",
  "id_contrato",
  "pedido",
  "os",
  "ordem_de_servico",
  "ordem_servico",
  "n_os",
];
const COL_STATUS: string[] = [
  "status",
  "status_evento",
  "situacao",
  "situação",
  "fase",
];
const COL_SIZE: string[] = ["tamanho", "size", "porte", "escala", "categoria_tamanho"];

type Col = { name?: string; display_name?: string; effective_name?: string; ident?: string };

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildColNameMap(cols: Col[]): Map<string, number> {
  const m = new Map<string, number>();
  cols.forEach((c, i) => {
    const raw = c.name || c.ident || c.display_name || c.effective_name || `c${i}`;
    m.set(normKey(String(raw)), i);
  });
  return m;
}

const DATE_VALUE_RE = /^\d{4}-\d{2}-\d{2}/;

/** Detecta automaticamente qual índice de coluna contém valores de data (YYYY-MM-DD ou ISO). */
function autoDetectDateColIndex(rows: unknown[][], numCols: number): number | null {
  const sample = rows.slice(0, 20);
  const counts = new Array<number>(numCols).fill(0);
  for (const row of sample) {
    if (!Array.isArray(row)) continue;
    for (let i = 0; i < numCols; i++) {
      const v = row[i];
      if (v == null) continue;
      const s = typeof v === "string" ? v.trim() : String(v);
      if (DATE_VALUE_RE.test(s)) counts[i]++;
    }
  }
  let best = -1, bestCount = 0;
  for (let i = 0; i < numCols; i++) {
    if (counts[i] > bestCount) { bestCount = counts[i]; best = i; }
  }
  return bestCount > 0 ? best : null;
}

function findIndex(aliases: string[], colMap: Map<string, number>): number | null {
  for (const a of aliases) {
    const i = colMap.get(normKey(a));
    if (i !== undefined) return i;
  }
  return null;
}

function getCell(row: unknown[], i: number | null): unknown {
  if (i == null) return undefined;
  return row[i];
}

function strOrU(x: unknown): string | undefined {
  if (x == null) return undefined;
  if (typeof x === "string" && x.trim() !== "") return x.trim();
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  return undefined;
}

// Abreviações de mês em PT-BR usadas em datetimes do Metabase ("28 abr. 2026, 22:30")
const PT_MONTHS_ABBR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

const PT_MONTHS_NORM = [
  "janeiro","fevereiro","marco","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
];

function normMonth(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Converte "28 abr. 2026, 22:30" ou "2 mai, 2026, 00:00" → YYYY-MM-DD. */
function parseBrDatetime(s: string): string | undefined {
  const m = s.match(/^(\d{1,2})\s+(\w{3})\.?,?\s+(\d{4})/);
  if (!m) return undefined;
  const monthIdx = PT_MONTHS_ABBR.indexOf(m[2].toLowerCase());
  if (monthIdx < 0) return undefined;
  const iso = `${m[3]}-${String(monthIdx + 1).padStart(2, "0")}-${String(parseInt(m[1], 10)).padStart(2, "0")}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return iso;
}

/** Converte "N Semana [Mês] de [Ano]" → YYYY-MM-DD (segunda-feira da Nª semana do mês). */
function parseSemanaLabel(s: string): string | undefined {
  const m = s.trim().match(/^(\d+)\s+semana\s+(\S+)\s+de\s+(\d{4})$/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  const monthIdx = PT_MONTHS_NORM.indexOf(normMonth(m[2]));
  if (monthIdx < 0 || n < 1 || n > 6) return undefined;
  const year = parseInt(m[3], 10);
  // Find the first Monday of the month
  const d = new Date(year, monthIdx, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  // Advance to the Nth Monday
  d.setDate(d.getDate() + (n - 1) * 7);
  if (d.getMonth() !== monthIdx) return undefined;
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateU(x: unknown): string | undefined {
  if (x == null) return undefined;
  if (x instanceof Date && !Number.isNaN(x.getTime())) {
    return x.toISOString().slice(0, 10);
  }
  if (typeof x === "string") {
    const s = x.trim();
    // "28 abr. 2026, 22:30" or "2 mai, 2026, 00:00" — formato datetime PT-BR do Metabase
    const brDt = parseBrDatetime(s);
    if (brDt) return brDt;
    // "N Semana [Mês] de [Ano]" — fallback para coluna SEMANA
    const semana = parseSemanaLabel(s);
    if (semana) return semana;
    // DD/MM/YYYY or DD/MM/YY
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      const year = y.length === 2 ? `20${y}` : y;
      const iso = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const t = new Date(iso);
      if (!Number.isNaN(t.getTime())) return iso;
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // ISO string or any parseable string
    const t = new Date(s);
    if (!Number.isNaN(t.getTime())) return t.toISOString().slice(0, 10);
  }
  if (typeof x === "number" && Number.isFinite(x)) {
    const t = new Date(x);
    if (!Number.isNaN(t.getTime())) return t.toISOString().slice(0, 10);
  }
  return undefined;
}

function buildFallbackMetabaseId(input: {
  contractId?: string;
  eventName?: string;
  eventDate?: string;
  endDate?: string;
  clientName?: string;
  city?: string;
  state?: string;
}): string {
  const parts = [
    input.contractId,
    input.eventName,
    input.eventDate,
    input.endDate,
    input.clientName,
    input.city,
    input.state,
  ]
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length > 0)
    .map(normKey)
    .filter((v) => v.length > 0);
  if (parts.length > 0) return `fb-${parts.join("__").slice(0, 180)}`;
  return "fb-sem-dados";
}

function mapStatus(s: string | undefined): ProjectStatus {
  if (!s) return "active";
  const t = s.trim();
  for (const { test, v } of STATUS_BY_TOKEN) {
    if (test(t)) return v;
  }
  if (t === "future" || t === "active" || t === "finished" || t === "cancelled") {
    return t;
  }
  return "active";
}

function mapSize(s: string | undefined): ProjectSize {
  if (!s) return "Unknown";
  const t = s.trim();
  for (const sz of SIZES) {
    if (sz === t) return sz;
  }
  const n = t.toLowerCase();
  for (const sz of SIZES) {
    if (sz.toLowerCase() === n) return sz;
  }
  return "Unknown";
}

type Dataset = {
  rows: unknown[][];
  cols: Col[];
};

/**
 * Resultado de uma pergunta Metabase: extrai `rows` + `cols` de respostas com shape variado.
 */
export function extractMetabaseDataset(body: unknown): Dataset | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    if (Array.isArray(d.rows) && Array.isArray(d.cols)) {
      return { rows: d.rows as unknown[][], cols: d.cols as Col[] };
    }
  }
  if (Array.isArray(o.rows) && Array.isArray(o.cols)) {
    return { rows: o.rows as unknown[][], cols: o.cols as Col[] };
  }
  return null;
}

/**
 * Mapeia cada linha do card Metabase para um `SGFOProject` com `source: "metabase"`.
 * **Orçamento (previsto/aprovado/realizado e estados) não vêm do Metabase** — nascem
 * sem orçamento; valores são preenchidos no SGFO (import Excel / edição).
 * Linhas sem coluna de id reconhecida são puladas.
 */
export function mapDatasetToSGFOProjects(dataset: Dataset, nowIso: string, dateColumnOverride?: string): { projects: SGFOProject[]; detectedDateCol: string | null } {
  const { rows, cols } = dataset;
  if (!rows.length) return { projects: [], detectedDateCol: null };
  const colMap = buildColNameMap(cols);
  const idxId = findIndex(COL_METABASE_ID, colMap) ?? 0;
  const idxEvent = findIndex(COL_EVENT, colMap) ?? 1;
  const dateAliases = dateColumnOverride ? [dateColumnOverride, ...COL_DATE] : COL_DATE;
  const idxResp = findIndex(["responsavel", "responsible", "owner", "gerente", "pm"], colMap);
  const idxSquad = findIndex(["squad", "time", "time_projeto", "time_proj"], colMap);

  // Resolve índice da coluna de data: alias → auto-detecção por valor
  let iDateResolved = findIndex(dateAliases, colMap);
  let detectedDateCol: string | null = null;
  if (iDateResolved == null) {
    const autoIdx = autoDetectDateColIndex(rows, cols.length);
    if (autoIdx != null) {
      iDateResolved = autoIdx;
      const c = cols[autoIdx];
      detectedDateCol = c.name ?? c.display_name ?? `col_${autoIdx}`;
    }
  } else {
    const c = cols[iDateResolved];
    detectedDateCol = c.name ?? c.display_name ?? `col_${iDateResolved}`;
  }

  const byEventId = new Map<string, SGFOProject>();
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    if (!Array.isArray(row)) continue;
    const iEv = findIndex(COL_EVENT, colMap);
    const eventName = strOrU(getCell(row, iEv != null ? iEv : idxEvent)) ?? "(sem nome)";
    const iContract = findIndex(COL_CONTRACT, colMap);
    const iClient = findIndex(COL_CLIENT, colMap);
    const iCity = findIndex(COL_CITY, colMap);
    const iUf = findIndex(COL_UF, colMap);
    const iDate = iDateResolved;
    const iSt = findIndex(COL_STATUS, colMap);
    const iSize = findIndex(COL_SIZE, colMap);
    const iNote = findIndex(["obs", "observacoes", "observacao", "notes", "comentario"], colMap);
    const iEnd = findIndex(COL_END_DATE, colMap);
    const contractId = iContract != null ? strOrU(getCell(row, iContract)) : undefined;
    const clientName = iClient != null ? strOrU(getCell(row, iClient)) : undefined;
    const city = iCity != null ? strOrU(getCell(row, iCity)) : undefined;
    const state = iUf != null ? strOrU(getCell(row, iUf)) : undefined;
    const eventDate = iDate != null ? parseDateU(getCell(row, iDate)) : undefined;
    const endDate = iEnd != null ? parseDateU(getCell(row, iEnd)) : undefined;
    const idRaw = getCell(row, idxId);
    const idStrRaw = strOrU(idRaw) ?? (idRaw != null && idRaw !== "" ? String(idRaw) : undefined);
    const idFromRow = idStrRaw && idStrRaw.trim() ? idStrRaw.trim() : null;
    const idIsFallback = !idFromRow;
    let idStr =
      idFromRow ??
      buildFallbackMetabaseId({
        contractId,
        eventName,
        eventDate,
        endDate,
        clientName,
        city,
        state,
      });
    if (idIsFallback && byEventId.has(idStr)) {
      idStr = `${idStr}#${rowIdx}`;
    }
    const project: SGFOProject = {
      id: makeProjectId({ metabaseId: idStr }),
      source: "metabase",
      metabaseId: idStr,
      contractId,
      eventName,
      clientName,
      city,
      state,
      eventDate,
      endDate,
      status: iSt == null ? "active" : mapStatus(strOrU(getCell(row, iSt))),
      size: iSize == null ? "Unknown" : mapSize(strOrU(getCell(row, iSize))),
      budgetStatus: "missing",
      budgetSource: "none",
      responsible: idxResp != null ? strOrU(getCell(row, idxResp)) : undefined,
      squad: idxSquad != null ? strOrU(getCell(row, idxSquad)) : undefined,
      plannedCost: undefined,
      approvedCost: undefined,
      realizedCost: undefined,
      notes: iNote == null ? undefined : strOrU(getCell(row, iNote)),
      importedAt: nowIso,
      lastSyncedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const prev = byEventId.get(idStr);
    if (!prev) {
      byEventId.set(idStr, project);
      continue;
    }
    // Preferimos a linha mais rica (com datas) quando houver duplicidade no dataset.
    const prevScore =
      (prev.eventDate ? 1 : 0) +
      (prev.endDate ? 1 : 0) +
      (prev.contractId ? 1 : 0) +
      (prev.clientName ? 1 : 0);
    const nextScore =
      (project.eventDate ? 1 : 0) +
      (project.endDate ? 1 : 0) +
      (project.contractId ? 1 : 0) +
      (project.clientName ? 1 : 0);
    if (nextScore >= prevScore) byEventId.set(idStr, project);
  }
  return { projects: Array.from(byEventId.values()), detectedDateCol };
}

/**
 * Garante nenhum valor de orçamento a partir de Metabase (cópia limpa p/ resposta/merge).
 */
export function stripMetabaseBudget(p: SGFOProject): SGFOProject {
  return {
    ...p,
    budgetStatus: "missing",
    budgetSource: "none",
    plannedCost: undefined,
    approvedCost: undefined,
    realizedCost: undefined,
  };
}

/**
 * O env deve ter o **número** do card (ex. `42`). Se colar a URL da pergunta
 * (`…/question/42` ou `https://metabase/…/card/42`), extraímos o id para não gerar
 * `POST /api/card/https://…/query` (400 "Ambiguous URI empty segment").
 */
export function normalizeMetabaseCardId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  if (/^https?:\/\//i.test(s)) {
    try {
      const p = new URL(s).pathname;
      const m = p.match(/\/(?:question|card|model)\/(\d+)\b/i);
      if (m) return m[1];
    } catch {
      return null;
    }
  }
  const m = s.match(/\/(?:question|card|model)\/(\d+)\b/i);
  if (m) return m[1];
  return /^\d+/.test(s) ? (s.match(/^(\d+)/)?.[1] ?? null) : null;
}

/**
 * JSON em `METABASE_QUERY_BODY_JSON` (opcional) funde no `POST` de `api/card/:id/query`,
 * p.ex. `{"parameters":[...]}` alinhado aos filtros do card. Objecto; não use array no top-level.
 */
export function parseMetabaseQueryBodyFromEnv():
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string } {
  const raw = process.env.METABASE_QUERY_BODY_JSON?.trim();
  if (!raw) return { ok: true, data: {} };
  try {
    const p = JSON.parse(raw) as unknown;
    if (p == null || typeof p !== "object" || Array.isArray(p)) {
      return {
        ok: false,
        error: 'O valor tem de ser um objecto JSON (ex. {"parameters":[]}), não um array no topo.',
      };
    }
    return { ok: true, data: p as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      error: "JSON inválido. Use uma linha (ou ficheiro .env com JSON escapado).",
    };
  }
}

/**
 * Se `METABASE_DATE_RANGE_PARAMETER_ID` estiver definido, insere ou substitui o parâmetro
 * de intervalo (valor `AAAA-MM-DD~AAAA-MM-DD`) no array `parameters` do corpo do POST.
 * O `id` tem de ser o UUID do filtro "Entre" **dessa** pergunma (vê o pedido na rede do browser).
 */
export function mergeDateRangeParameterIntoQueryBody(
  base: Record<string, unknown>,
  from: string,
  to: string
): Record<string, unknown> {
  const paramId = process.env.METABASE_DATE_RANGE_PARAMETER_ID?.trim();
  if (!paramId) {
    return { ...base };
  }
  const { from: a, to: b } = orderDateRange(from, to);
  const value = `${a}~${b}`;
  const type = process.env.METABASE_DATE_RANGE_PARAMETER_TYPE?.trim() || "date/range";
  const out: Record<string, unknown> = { ...base };
  const raw = out.parameters;
  const list: unknown[] = Array.isArray(raw) ? [...raw] : [];
  const next = list.filter((item) => {
    if (item && typeof item === "object" && item !== null && "id" in item) {
      return (item as { id: string }).id !== paramId;
    }
    return true;
  });
  next.push({ id: paramId, type, value });
  out.parameters = next;
  return out;
}

/**
 * Busca os metadados do card (/api/card/:id) para descobrir os parâmetros disponíveis.
 * Retorna o primeiro parâmetro de data/range encontrado, ou null.
 */
export async function fetchCardDateParameter(
  baseUrl: string,
  apiKey: string,
  cardId: string
): Promise<{ id: string; type: string } | null> {
  const id = normalizeMetabaseCardId(cardId);
  if (!id) return null;
  const u = new URL(
    `api/card/${id}`.replace(/^\//, ""),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  );
  try {
    const res = await fetch(u, {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const params = json.parameters;
    if (!Array.isArray(params)) return null;
    for (const p of params) {
      if (!p || typeof p !== "object") continue;
      const param = p as Record<string, unknown>;
      const type = typeof param.type === "string" ? param.type : "";
      if (type.startsWith("date") && typeof param.id === "string") {
        return { id: param.id, type };
      }
    }
  } catch { /* no-op */ }
  return null;
}

/**
 * Faz a query do card e devolve o dataset parseado, ou `null` + mensagem.
 * @param extraBody funde-se por cima de `{ ignore_cache: false }` (o env pode definir `ignore_cache`).
 */
export async function fetchMetabaseCardJson(
  baseUrl: string,
  apiKey: string,
  cardId: string,
  extraBody: Record<string, unknown> = {}
): Promise<{ ok: true; json: unknown } | { ok: false; error: string; status?: number }> {
  const id = normalizeMetabaseCardId(cardId);
  if (!id) {
    return {
      ok: false,
      error:
        "METABASE_QUESTION_ID inválido. Preencha só o número do card (ex. 42) no Metabase, ou a URL completa da pergunta; não use a URL /api/… do navegador.",
    };
  }
  const u = new URL(
    `api/card/${id}/query`.replace(/^\//, ""),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  );
  const body = { ignore_cache: false, ...extraBody };
  const res = await fetch(u, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false,
      error: t.slice(0, 800) || res.statusText,
      status: res.status,
    };
  }
  const json = (await res.json()) as unknown;
  return { ok: true, json };
}

/**
 * Faz a query do card via **dashcard endpoint** — usado quando o filtro de datas vive no
 * dashboard (e não na própria pergunta). Permite passar `parameters` mapeados aos campos
 * do dashboard (ex.: Data Início e Data Término), reproduzindo o que o Metabase mostra.
 *
 * `POST /api/dashboard/:dashboardId/dashcard/:dashcardId/card/:cardId/query`
 */
export async function fetchMetabaseDashcardJson(
  baseUrl: string,
  apiKey: string,
  dashboardId: string,
  dashcardId: string,
  cardId: string,
  parameters: Array<Record<string, unknown>>
): Promise<{ ok: true; json: unknown } | { ok: false; error: string; status?: number }> {
  const cid = normalizeMetabaseCardId(cardId);
  if (!cid) {
    return {
      ok: false,
      error:
        "METABASE_QUESTION_ID inválido. Preencha só o número do card (ex. 42) no Metabase.",
    };
  }
  const path = `api/dashboard/${dashboardId}/dashcard/${dashcardId}/card/${cid}/query`;
  const u = new URL(
    path.replace(/^\//, ""),
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  );
  const res = await fetch(u, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ parameters }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 800) || res.statusText, status: res.status };
  }
  const json = (await res.json()) as unknown;
  return { ok: true, json };
}

const UNAUTH_RE = /unauthenticated|not authenticated|401|session/i;
const FORBIDDEN_RE = /n[aã]o tem permiss|don'?t have permission|forbidden|403|not allowed to/i;

/**
 * Texto do Metabase muitas vezes é curto — devolve instruções em português.
 */
export function formatMetabaseFetchError(raw: string, status?: number): string {
  const t = (raw || "").trim();
  if (status === 401 || UNAUTH_RE.test(t)) {
    return [
      "Metabase recusou a chave (Unauthenticated).",
      "1) Crie uma API Key no Metabase: Admin (engrenagem) → Authentication → API keys → New API key, com acesso a este conteúdo.",
      "2) Cole o valor exato em METABASE_API_KEY no .env.local (sem aspas a mais, sem espaço no fim).",
      "3) Reinicie o `npm run dev`.",
      "Não use senha de utilizador aqui: tem de ser a API key gerada no admin.",
    ].join(" ");
  }
  if (status === 403 || FORBIDDEN_RE.test(t)) {
    return [
      "A chave funciona, mas o Metabase negou a execução desta pergunta (permissão).",
      "1) Garanta que a API key tem permissão para a pasta/coleção onde o card está (Admin → People → grupo da chave, ou permissions da collection).",
      "2) Ou crie a API key associada a um utilizador que já consegue abrir essa pergunta no Metabase (o mesmo acesso do browser).",
      "3) Confirme que METABASE_QUESTION_ID é o ID da pergunta que o teu user vê, não de outro workspace.",
    ].join(" ");
  }
  if (t.length < 500) return t;
  return `${t.slice(0, 400)}…`;
}
