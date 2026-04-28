/**
 * Semanas ISO e filtro **entre datas (YYYY-MM-DD)**, alinhado ao "entre" do Metabase
 * (inclusive), sem o desvio da semana ISO do browser.
 */

/** [start, end] YYYY-MM-DD (inclusivo) do ISO year / week. */
export function getIsoWeekBounds(isoYear: number, week: number): { start: string; end: string } {
  const wk = Math.max(1, Math.min(53, Math.floor(week)));
  // Segunda da semana 1: é a que contém 4 de janeiro (regra ISO).
  const j4 = new Date(isoYear, 0, 4, 12, 0, 0, 0);
  const w1 = new Date(j4);
  w1.setDate(j4.getDate() - ((j4.getDay() + 6) % 7));
  const mon = new Date(w1);
  mon.setDate(w1.getDate() + (wk - 1) * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: toYmd(mon), end: toYmd(sun) };
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Só a parte AAAA-MM-DD, string compare é segura. */
export function ymdInIsoWeek(ymd: string, isoYear: number, week: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(ymd)) return false;
  const a = ymd.slice(0, 10);
  const { start, end } = getIsoWeekBounds(isoYear, week);
  return a >= start && a <= end;
}

/**
 * ISO week + year para a data "hoje" (ajuda default na UI e na API).
 */
export function getTodayIsoYearWeek(): { year: number; week: number } {
  return getIsoYearAndWeekForDate(new Date());
}

export function getIsoYearAndWeekForDate(d: Date): { year: number; week: number } {
  const t = toYmd(d);
  for (const y of [d.getFullYear() - 1, d.getFullYear(), d.getFullYear() + 1] as const) {
    for (let w = 1; w <= 53; w += 1) {
      if (ymdInIsoWeek(t, y, w)) return { year: y, week: w };
    }
  }
  // Fallback: semana 1
  return { year: d.getFullYear(), week: 1 };
}

/** Filtro: só projetos cujo `eventDate` cai nessa semana. */
export function hasEventInIsoWeek(
  eventDate: string | undefined,
  isoYear: number,
  week: number
): boolean {
  if (!eventDate || !eventDate.trim()) return false;
  return ymdInIsoWeek(eventDate, isoYear, week);
}

// --- Filtro por intervalo (igual lógica ao Metabase: entre duas datas, inclusive) ---

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Só a parte AAAA-MM-DD; comparação lexicográfica bate com ordem de calendário. */
export function eventYmdFromField(eventDate: string | undefined): string | null {
  if (!eventDate || !String(eventDate).trim()) return null;
  const s = String(eventDate).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.slice(0, 10);
}

export function orderDateRange(
  from: string,
  to: string
): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

export function parseYmdParam(
  s: string | null | undefined
): string | null {
  if (s == null || !String(s).trim()) return null;
  const t = String(s).trim().slice(0, 10);
  return YMD_RE.test(t) ? t : null;
}

/** "Hoje" (calendário) no fuso de São Paulo, YYYY-MM-DD. */
export function ymdInTimeZone(d: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = p.find((x) => x.type === "year")?.value;
  const m = p.find((x) => x.type === "month")?.value;
  const day = p.find((x) => x.type === "day")?.value;
  if (!y || !m || !day) return toYmd(d);
  return `${y}-${m}-${day}`;
}

/** Padrão sync: 7 dias corridos a partir de 6 dias antes de hoje até hoje (Brasil). */
export function getDefaultMetabaseSyncDateRange(): { from: string; to: string } {
  const to = ymdInTimeZone(new Date(), "America/Sao_Paulo");
  const noonBrt = new Date(`${to}T12:00:00-03:00`);
  const fromInst = new Date(noonBrt.getTime() - 6 * 24 * 60 * 60 * 1000);
  const from = ymdInTimeZone(fromInst, "America/Sao_Paulo");
  return orderDateRange(from, to);
}

/**
 * Filtro "entre" (inclusivo) na data do evento — mesma regra de um time range do Metabase.
 */
export function hasEventInYmdRange(
  eventDate: string | undefined,
  from: string,
  to: string
): boolean {
  const y = eventYmdFromField(eventDate);
  if (!y) return false;
  const { from: a, to: b } = orderDateRange(from, to);
  return y >= a && y <= b;
}
