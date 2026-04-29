/**
 * Relatório PDF "Justificativas operacionais 5W2H" → itens de backlog.
 * GUT: se o PDF tiver G/U/T explícitos, usa; senão heurística por Tipo
 * (coordenador ajusta no SGFO — a lista ordena por G×U×T).
 */

export type ParsedJustificativa = {
  title: string;
  taskId: string;
  tipo: string;
  what: string;
  why: string;
  who: string;
  where: string;
  when: string;
  how: string;
  howMuch: string;
  actionPlan: string;
  gravity: number;
  urgency: number;
  tendency: number;
  gutFromPdf: boolean;
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const clampGut = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

/** Heurística quando o PDF não traz matriz GUT (comum) — o coord. confirma no app. */
export function defaultGutFromTipo(tipoRaw: string): { gravity: number; urgency: number; tendency: number } {
  const t = tipoRaw.toLowerCase();
  if (t.includes("falha interna") || t.includes("falha no") || t.includes("falha ")) {
    return { gravity: 4, urgency: 4, tendency: 4 };
  }
  if (t.includes("ativação fora") || t.includes("fora do sla") || t.includes("fora com")) {
    return { gravity: 5, urgency: 5, tendency: 4 };
  }
  if (t.includes("atraso")) {
    return { gravity: 3, urgency: 4, tendency: 3 };
  }
  return { gravity: 3, urgency: 3, tendency: 3 };
}

function tryParseGut(block: string): { g: number; u: number; t: number } | null {
  const full = block.match(
    /(?:Gravidade|G)\s*[:：=]\s*([1-5])[\s\S]*?(?:Urgência|U)\s*[:：=]\s*([1-5])[\s\S]*?(?:Tendência|T)\s*[:：=]\s*([1-5])/i
  );
  if (full) {
    return { g: clampGut(+full[1]!), u: clampGut(+full[2]!), t: clampGut(+full[3]!) };
  }
  const tri = block.match(
    /(?:GUT|Matriz)\s*[:：=]?\s*([1-5])[\s,;/\-.]+\s*([1-5])[\s,;/\-.]+\s*([1-5])/i
  );
  if (tri) {
    return { g: clampGut(+tri[1]!), u: clampGut(+tri[2]!), t: clampGut(+tri[3]!) };
  }
  return null;
}

function cleanText(raw: string) {
  return raw.replace(/--\s*\d+\s*of\s*\d+\s*--/g, "").replace(/\n{3,}/g, "\n\n");
}

/** Conteúdo de um campo até a primeira linha de `ends` (mais cedo vence). */
function sliceField(block: string, start: RegExp, ends: RegExp[], stripPlanoInWhy = false): string {
  const m = block.match(start);
  if (!m || m.index === undefined) return "";
  const rest = block.slice(m.index + m[0]!.length);
  let end = rest.length;
  for (const re of ends) {
    const p = rest.search(re);
    if (p >= 0 && p < end) end = p;
  }
  let body = rest.slice(0, end);
  if (stripPlanoInWhy) {
    const q = body.search(/\bPLANO DE AÇÃO\b/i);
    if (q >= 0) body = body.slice(0, q);
  }
  return norm(body);
}

function extractHowMuch(block: string): string {
  const s = sliceField(block, /HOW\s+MUCH[\s—-]*/i, [
    /\nPLANO DE AÇÃO\b/i,
    /\nWHAT\s*—/i,
    /\n[^\n]+\|\s*Task ID:/i,
  ]);
  if (s) {
    return s
      .replace(/^(?:Quanto custa\?|Quanto\?|Quanto)\s*/i, "")
      .replace(/--\s*\d+\s*of\s*\d+\s*--/g, "")
      .trim() || s;
  }
  return "—";
}

function extractPlanoAcao(block: string): string {
  const m = block.match(
    /PLANO DE AÇÃO\s*([\s\S]+?)(?=(?:\n(?=[^\n]+?\s*\|\s*Task ID:\s*))|\Z)/i
  );
  return m?.[1] ? norm(m[1].replace(/^\d+\.\s*/gm, " ")) : "";
}

function parseOneBlock(block: string): ParsedJustificativa | null {
  const head = block.split(/\n/)[0] ?? "";
  if (!/Task ID:/i.test(block)) return null;
  const tidM = head.match(/\|\s*Task ID:\s*(.+)$/i) || block.match(/Task ID:\s*([^\n]+)/i);
  if (!tidM) return null;
  const taskId = norm(tidM[1]!);
  const title = norm(head.replace(/\s*\|\s*Task ID:\s*.+$/i, "")) || "Sem título";
  const tipoM = block.match(/Tipo:\s*([^\n]+)/i);
  const tipo = (tipoM?.[1] ?? "—").trim() || "—";
  const what =
    sliceField(block, /WHAT\s*—\s*O quê\??/i, [/\nWHY\s*—/i, /\nPLANO DE AÇÃO\b/i]) ||
    sliceField(block, /WHAT\s*—/i, [/\nWHY\s*—/i, /\nPLANO DE AÇÃO\b/i]) ||
    "—";
  const why =
    sliceField(block, /WHY\s*—\s*Por quê\??/i, [/\nWHO\s*—/i, /\nPLANO DE AÇÃO\b/i], true) ||
    sliceField(block, /WHY\s*—/i, [/\nWHO\s*—/i, /\nPLANO DE AÇÃO\b/i], true) ||
    "—";
  const who =
    sliceField(block, /WHO\s*—\s*Quem\??/i, [/\nWHERE\s*—/i, /\nPLANO DE AÇÃO\b/i]) ||
    sliceField(block, /WHO\s*—/i, [/\nWHERE\s*—/i, /\nPLANO DE AÇÃO\b/i]) ||
    "—";
  const where =
    sliceField(block, /WHERE\s*—\s*Onde\??/i, [/\nWHEN\s*—/i, /\nPLANO DE AÇÃO\b/i]) ||
    sliceField(block, /WHERE\s*—/i, [/\nWHEN\s*—/i, /\nPLANO DE AÇÃO\b/i]) ||
    "—";
  const when =
    sliceField(block, /WHEN\s*—\s*Quando\??/i, [/\nHOW\s*—/i, /\nHOW\s+MUCH/i, /\nPLANO DE AÇÃO\b/i]) ||
    sliceField(block, /WHEN\s*—/i, [/\nHOW\s*—/i, /\nHOW\s+MUCH/i, /\nPLANO DE AÇÃO\b/i]) ||
    "—";
  const how =
    sliceField(block, /HOW\s*—\s*Como\??/i, [/\nHOW\s+MUCH/i, /\nPLANO DE AÇÃO\b/i]) ||
    sliceField(block, /HOW\s*—/i, [/\nHOW\s+MUCH/i, /\nPLANO DE AÇÃO\b/i]) ||
    "—";
  const howMuch = extractHowMuch(block);
  const actionPlan = extractPlanoAcao(block);

  const gutPdf = tryParseGut(block);
  const h = defaultGutFromTipo(tipo);
  return {
    title,
    taskId,
    tipo,
    what: what || "—",
    why: why || "—",
    who: who || "—",
    where: where || "—",
    when: when || "—",
    how: how || "—",
    howMuch: howMuch || "—",
    actionPlan,
    gravity: gutPdf ? gutPdf.g : h.gravity,
    urgency: gutPdf ? gutPdf.u : h.urgency,
    tendency: gutPdf ? gutPdf.t : h.tendency,
    gutFromPdf: Boolean(gutPdf),
  };
}

export function parseJustificativas5w2hText(raw: string): { items: ParsedJustificativa[]; warnings: string[] } {
  const warnings: string[] = [];
  const t = cleanText(raw);
  const firstCase = t.search(/[^\n]+\s*\|\s*Task ID:\s*/i);
  if (firstCase < 0) {
    return { items: [], warnings: ['Não encontrámos o padrão «| Task ID:» (modelo 5W2H do SGFO).'] };
  }
  const header = t.slice(0, firstCase).trim();
  const rest = t.slice(firstCase);
  const blockStrs = rest
    .split(/\n(?=[^\n]+?\s*\|\s*Task ID:\s*)/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!header.toUpperCase().includes("RELAT") && blockStrs.length) {
    warnings.push("Cabeçalho não reconhecido; blocos a partir de «| Task ID:».");
  }
  const items: ParsedJustificativa[] = [];
  for (const b of blockStrs) {
    const p = parseOneBlock(b);
    if (p) items.push(p);
  }
  if (items.length === 0) {
    warnings.push("Não foi possível mapear itens. Confirme o modelo do PDF.");
  } else {
    const noGut = items.filter((i) => !i.gutFromPdf).length;
    if (noGut > 0) {
      warnings.push(
        `GUT não encontrado no texto de ${noGut} ação(ões) — usámos heurística por Tipo. O coordenador deve ajustar G, U e T (prioridade da fila: maior G×U×T primeiro).`
      );
    }
  }
  return { items, warnings: [...new Set(warnings)] };
}
