import { NextResponse } from "next/server";
import { extractMetabaseDataset, fetchMetabaseCardJson, normalizeMetabaseCardId } from "@/lib/projects/metabaseApi";

/**
 * Diagnóstico: mostra colunas e primeiras 5 linhas brutas do card Metabase.
 * Acesse: GET /api/projects/metabase/debug
 */
export async function GET() {
  const base = process.env.METABASE_URL?.trim();
  const key = process.env.METABASE_API_KEY?.trim();
  const cardId = process.env.METABASE_QUESTION_ID?.trim();
  if (!base || !key || !cardId) {
    return NextResponse.json({ ok: false, error: "Env vars não configuradas" }, { status: 503 });
  }
  const id = normalizeMetabaseCardId(cardId);
  if (!id) return NextResponse.json({ ok: false, error: "METABASE_QUESTION_ID inválido" }, { status: 400 });

  const res = await fetchMetabaseCardJson(base, key, cardId, {});
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 502 });

  const dataset = extractMetabaseDataset(res.json);
  if (!dataset) return NextResponse.json({ ok: false, error: "Dataset não encontrado" }, { status: 502 });

  const cols = dataset.cols.map((c, i) => ({
    index: i,
    name: c.name,
    display_name: (c as Record<string, unknown>).display_name,
    base_type: (c as Record<string, unknown>).base_type,
  }));

  const rows5 = dataset.rows.slice(0, 5).map((row) => {
    if (!Array.isArray(row)) return row;
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => { obj[c.name ?? `col_${i}`] = row[i]; });
    return obj;
  });

  return NextResponse.json({ ok: true, totalRows: dataset.rows.length, cols, rows5 });
}
