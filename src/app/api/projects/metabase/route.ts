import { NextRequest, NextResponse } from "next/server";
import { orderDateRange, parseYmdParam } from "@/lib/projects/isoWeek";
import {
  extractMetabaseDataset,
  fetchMetabaseDashcardJson,
  fetchMetabaseCardJson,
  formatMetabaseFetchError,
  mapDatasetToSGFOProjects,
  parseMetabaseQueryBodyFromEnv,
  stripMetabaseBudget,
} from "@/lib/projects/metabaseApi";

/**
 * Sincronização com o Metabase (server-only). Devolve o resultado da query do card
 * mapeada para `SGFOProject`.
 *
 * Quando METABASE_DASHBOARD_ID + METABASE_DASHCARD_ID + parâmetros de data estão
 * configurados, usa o endpoint de dashcard — que aceita os parâmetros do dashboard
 * (Data Início / Data Término) e filtra no banco. Caso contrário, busca todos os
 * dados do card e filtra no cliente pelo overlap INICIO/FIM.
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

  const pFrom = parseYmdParam(request.nextUrl.searchParams.get("from"));
  const pTo = parseYmdParam(request.nextUrl.searchParams.get("to"));

  const dashboardId = process.env.METABASE_DASHBOARD_ID?.trim();
  const dashcardId = process.env.METABASE_DASHCARD_ID?.trim();
  const startParamId = process.env.METABASE_DATE_START_PARAMETER_ID?.trim();
  const endParamId = process.env.METABASE_DATE_END_PARAMETER_ID?.trim();
  const useDashcard = !!(pFrom && pTo && dashboardId && dashcardId && (startParamId || endParamId));

  let res: Awaited<ReturnType<typeof fetchMetabaseCardJson>>;
  let usedRoute: "card" | "dashcard" = "card";

  if (useDashcard) {
    const { from, to } = orderDateRange(pFrom!, pTo!);
    const value = `${from}~${to}`;
    const parameters: Array<Record<string, unknown>> = [];
    if (startParamId) parameters.push({ id: startParamId, type: "date/all-options", value });
    if (endParamId) parameters.push({ id: endParamId, type: "date/all-options", value });
    res = await fetchMetabaseDashcardJson(base, key, dashboardId!, dashcardId!, cardId, parameters);
    usedRoute = "dashcard";
  } else {
    const queryBody = parseMetabaseQueryBodyFromEnv();
    if (!queryBody.ok) {
      return NextResponse.json(
        { ok: false, error: "config", message: `METABASE_QUERY_BODY_JSON: ${queryBody.error}` },
        { status: 503 }
      );
    }
    res = await fetchMetabaseCardJson(base, key, cardId, { ...queryBody.data });
  }

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

  // Quando não usamos dashcard, filtramos client-side pelo overlap INICIO/FIM.
  if (!useDashcard && pFrom && pTo) {
    const { from, to } = orderDateRange(pFrom, pTo);
    projects = projects.filter((p) => {
      const start = p.eventDate;
      const end = p.endDate ?? p.eventDate;
      if (!start || !end) return false;
      return start <= to && end >= from;
    });
  }

  const colNames = dataset.cols.map((c) => c.name ?? c.display_name ?? "?");
  let dateSamples: unknown[] = [];
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
    _debug: {
      colNames,
      detectedDateCol: mapped.detectedDateCol,
      dateColOverride: dateColOverride ?? null,
      rawCount,
      mappedCount,
      parsedDateCount,
      parsedSamples,
      dateSamples,
      route: usedRoute,
    },
  });
}

export const GET = handleMetabaseRequest;
export const POST = handleMetabaseRequest;
