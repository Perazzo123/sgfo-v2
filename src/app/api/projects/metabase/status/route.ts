import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Indica se o servidor tem METABASE_URL, METABASE_API_KEY e METABASE_QUESTION_ID
 * (sem expor segredos). Inclui `missing` com os nomes em falta para a UI.
 */
export function GET() {
  const base = process.env.METABASE_URL?.trim();
  const key = process.env.METABASE_API_KEY?.trim();
  const cardId = process.env.METABASE_QUESTION_ID?.trim();
  const missing: string[] = [];
  if (!base) missing.push("METABASE_URL");
  if (!key) missing.push("METABASE_API_KEY");
  if (!cardId) missing.push("METABASE_QUESTION_ID");
  const configured = missing.length === 0;
  return NextResponse.json(
    { ok: true, configured, missing },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
