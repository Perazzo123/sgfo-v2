import { NextRequest, NextResponse } from "next/server";
import { orderDateRange, parseYmdParam } from "@/lib/projects/isoWeek";
import {
  extractMetabaseDataset,
  fetchCardDateParameter,
  fetchMetabaseCardJson,
  formatMetabaseFetchError,
  mapDatasetToSGFOProjects,
  mergeDateRangeParameterIntoQueryBody,
  parseMetabaseQueryBodyFromEnv,
  stripMetabaseBudget,
} from "@/lib/projects/metabaseApi";

/**
 * Sincronização com o Metabase (server-only). Devolve o resultado da query do card
 * mapeada para `SGFOProject` (o card deve ser tabela com colunas mapeáveis, não um gráfico
 * de agregação, salvo ajuste).
 *
 * Obrigatórias: METABASE_URL, METABASE_API_KEY, METABASE_QUESTION_ID.
 * Opcional: METABASE_QUERY_BODY_JSON — corpo extra do POST (p.ex. `parameters` fixos).
 * Opcional: METABASE_DATE_RANGE_PARAMETER_ID — UUID do filtro «Entre» do card; com `?from=&to=`
 *   na query (início/fim do ecrã), o SGFO preenche/repõe esse parâmetro (valor `início~fim`).
 * Opcional: METABASE_DATE_RANGE_PARAMETER_TYPE (padrão `date/range`). METABASE_SYNC_SECRET, etc.
 * Com `?from=&to=`, o SGFO **corta** o resultado pela data do evento nesse intervalo, mesmo que
 * a query do card traga mais linhas.
 */
function isSyncAuthorized(request: NextRequest): boolean {
  const secret = process.env.METABASE_SYNC_SECRET?.trim();
  if (!secret) return true;
  return request.headers.get("x-sgfo-sync") === secret;
}

export async function handleMetabaseRequest(request: NextRequest) {
  if (!isSyncAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Sincronização exige o header x-sgfo-sync." },
      { status: 401 }
    );
  }
  const base = process.env.METABASE_URL?.trim();
  const key = process.env.METABASE_API_KEY?.trim();
  const cardId = process.env.METABASE_QUESTION_ID?.trim();
  if (!base || !key || !cardId) {
    return NextResponse.json(
      {
        ok: false,
        error: "config",
        message:
          "Sincronização indisponível: configure METABASE_URL, METABASE_API_KEY e METABASE_QUESTION_ID no projeto (Vercel → Settings → Environment Variables).",
      },
      { status: 503 }
    );
  }
  const queryBody = parseMetabaseQueryBodyFromEnv();
  if (!queryBody.ok) {
    return NextResponse.json(
      { ok: false, error: "config", message: `METABASE_QUERY_BODY_JSON: ${queryBody.error}` },
      { status: 503 }
    );
  }
  const pFrom = parseYmdParam(request.nextUrl.searchParams.get("from"));
  const pTo = parseYmdParam(request.nextUrl.searchParams.get("to"));
  let postBody: Record<string, unknown> = { ...queryBody.data };
  let autoParamId: string | null = null;
  if (pFrom && pTo) {
    const { from, to } = orderDateRange(pFrom, pTo);
    if (!process.env.METABASE_DATE_RANGE_PARAMETER_ID?.trim()
      && !process.env.METABASE_DATE_START_PARAMETER_ID?.trim()) {
      const auto = await fetchCardDateParameter(base, key, cardId);
      if (auto) {
        autoParamId = auto.id;
        process.env.METABASE_DATE_RANGE_PARAMETER_ID = auto.id;
        if (!process.env.METABASE_DATE_RANGE_PARAMETER_TYPE) {
          process.env.METABASE_DATE_RANGE_PARAMETER_TYPE = auto.type;
        }
      }
    }
    postBody = mergeDateRangeParameterIntoQueryBody(postBody, from, to);
  }
  const res = await fetchMetabaseCardJson(base, key, cardId, postBody);
  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "metabase",
        status: res.status,
        message: formatMetabaseFetchError(res.error, res.status),
      },
      { status: 502 }
    );
  }
  const dataset = extractMetabaseDataset(res.json);
  if (!dataset) {
    return NextResponse.json(
      {
        ok: false,
        error: "parse",
        message:
          "A resposta do card não traz o formato { data: { rows, cols } } (ou equivalente) esperado.",
      },
      { status: 502 }
    );
  }
  const now = new Date().toISOString();
  const dateColOverride = process.env.METABASE_DATE_COLUMN?.trim() || undefined;
  const mapped = mapDatasetToSGFOProjects(dataset, now, dateColOverride);
  let projects = mapped.projects.map(stripMetabaseBudget);
  const rawCount = dataset.rows.length;
  const mappedCount = projects.length;

  const parsedDateCount = projects.filter((p) => !!p.eventDate).length;

  if (pFrom && pTo) {
    const { from, to } = orderDateRange(pFrom, pTo);
    // Sem dashcard: aplicamos a mesma lógica do dashboard (Data Início ∩ Data Término no
    // intervalo) para alinhar a contagem com o que o Metabase mostra.
    projects = projects.filter((p) => {
      const start = p.eventDate;
      const end = p.endDate ?? p.eventDate;
      if (!start && !end) return false;
      const startIn = !!start && start >= from && start <= to;
      const endIn = !!end && end >= from && end <= to;
      const overlaps = !!start && !!end && start <= to && end >= from;
      return startIn || endIn || overlaps;
    });
  }

  const colNames = dataset.cols.map((c) => c.name ?? c.display_name ?? "?");

  // Amostras brutas da coluna de data detectada (primeiras 5 linhas)
  let dateSamples: unknown[] = [];
  // Datas parseadas das primeiras 5 linhas (para confirmar que parseSemanaLabel funciona)
  const parsedSamples = mapped.projects.slice(0, 5).map((p) => p.eventDate ?? null);
  if (mapped.detectedDateCol) {
    const idx = colNames.indexOf(mapped.detectedDateCol);
    if (idx >= 0) {
      dateSamples = dataset.rows.slice(0, 5).map((r) => (Array.isArray(r) ? r[idx] : null));
    }
  }

  return NextResponse.json({
    ok: true,
    count: projects.length,
    projects,
    syncedAt: now,
    _debug: { colNames, detectedDateCol: mapped.detectedDateCol, dateColOverride: dateColOverride ?? null, autoParamId, rawCount, mappedCount, parsedDateCount, parsedSamples, dateSamples },
  });
}

export const GET = handleMetabaseRequest;
export const POST = handleMetabaseRequest;
