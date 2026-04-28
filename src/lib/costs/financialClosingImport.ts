/**
 * Cliente: faz upload do PDF para a rota Node `/api/costs/financial-closing`,
 * onde o parsing é feito com `pdf-parse` (server). Evita os problemas do
 * worker do PDF.js no browser e funciona sem rede pública.
 */
export type {
  FinancialClosingDebugItem,
  FinancialClosingExtraction,
  FinancialClosingEntry,
  FinancialClosingCategory,
} from "@/lib/costs/financialClosingParser";

import type { FinancialClosingExtraction } from "@/lib/costs/financialClosingParser";

export async function extractFinancialClosingFromPdf(
  file: File
): Promise<FinancialClosingExtraction> {
  if (!file) {
    return emptyExtraction("");
  }
  if (!/\.pdf$/i.test(file.name)) {
    return emptyExtraction(file.name, ["O fechamento financeiro deve ser enviado em PDF."]);
  }

  const fd = new FormData();
  fd.append("file", file);

  let resp: Response;
  try {
    resp = await fetch("/api/costs/financial-closing", { method: "POST", body: fd });
  } catch (e) {
    return emptyExtraction(file.name, [
      `Falha de rede ao enviar PDF: ${e instanceof Error ? e.message : "desconhecido"}`,
    ]);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    let msg = `Servidor respondeu ${resp.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      if (text) msg = text;
    }
    return emptyExtraction(file.name, [msg]);
  }

  return (await resp.json()) as FinancialClosingExtraction;
}

function emptyExtraction(fileName: string, warnings: string[] = []): FinancialClosingExtraction {
  return {
    fileName,
    teamCanto: null,
    otherExpenses: null,
    total: 0,
    sourceSheet: null,
    sheetNames: [],
    warnings,
    debug: [],
    entries: [],
  };
}
