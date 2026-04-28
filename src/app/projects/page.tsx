"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import {
  matchDateRangeProjectsVsBudget,
  projectHasSgfoBudget,
  formatCurrency,
  formatDate,
  getBudgetStatusLabel,
  getProjectStatusLabel,
  makeProjectId,
} from "@/lib/projects/helpers";
import {
  applyMetabaseSync,
  deleteProject,
  getProjectsStore,
  seedMockProjectsIfEmpty,
  updateProject,
  upsertProject,
} from "@/lib/projects/storage";
import {
  getDefaultMetabaseSyncDateRange,
  orderDateRange,
} from "@/lib/projects/isoWeek";
import { PROJECT_LIST_HEADERS, type ProjectListDataKey } from "@/lib/projects/projectListColumns";
import { EMPTY_PROJECTS_STORE, type BudgetStatus, type ProjectSize, type ProjectSource, type ProjectStatus, type SGFOProject, type ProjectsStore } from "@/lib/projects/types";

const S = {
  bg: "#020810",
  border: "rgba(6,214,245,0.12)",
  text: "#c8e8ff",
  muted: "#4a7a9a",
  dim: "#2a5070",
  accent: "#0ea5e9",
  inputBg: "#050e1f",
};

const STATUS_OPTS: { v: ProjectStatus; l: string }[] = [
  { v: "future", l: "Futuro" },
  { v: "active", l: "Ativo" },
  { v: "finished", l: "Concluído" },
  { v: "cancelled", l: "Cancelado" },
];

const SIZE_OPTS: ProjectSize[] = [
  "PP",
  "P",
  "M",
  "G",
  "Mega",
  "SuperMega",
  "Unknown",
];

const BUDGET_OPTS: BudgetStatus[] = [
  "missing",
  "estimated",
  "approved",
  "closed",
  "not_required",
];

const BUDGET_SOURCE_OPTS: SGFOProject["budgetSource"][] = ["none", "manual", "xlsx", "sgfo"];

const SOURCE_FILTER: (ProjectSource | "all")[] = ["all", "metabase", "manual"];

function inputStyle(): React.CSSProperties {
  return {
    background: S.inputBg,
    color: S.text,
    border: `1px solid ${S.border}`,
  };
}

function sourceLabel(s: ProjectSource): string {
  return s === "metabase" ? "Metabase" : "Manual";
}

function projectListCell(
  p: SGFOProject,
  key: ProjectListDataKey
): React.ReactNode {
  switch (key) {
    case "metabaseId":
      return <span className="tabular-nums" title={p.id}>{p.metabaseId?.trim() ? p.metabaseId : "—"}</span>;
    case "contractId":
      return p.contractId?.trim() ? p.contractId : "—";
    case "eventName":
      return p.eventName;
    case "clientName":
      return p.clientName?.trim() ? p.clientName : "—";
    case "eventDate":
      return <span className="tabular-nums">{formatDate(p.eventDate)}</span>;
    case "endDate":
      return <span className="tabular-nums">{formatDate(p.endDate)}</span>;
    case "city":
      return p.city?.trim() ? p.city : "—";
    case "state":
      return p.state?.trim() ? p.state : "—";
    case "status":
      return getProjectStatusLabel(p.status);
    case "size":
      return p.size;
    case "responsible":
      return p.responsible?.trim() ? p.responsible : "—";
    case "squad":
      return p.squad?.trim() ? p.squad : "—";
    case "plannedCost":
    case "approvedCost":
    case "realizedCost": {
      const n = p[key];
      return <span className="tabular-nums">{formatCurrency(n)}</span>;
    }
    case "budgetStatus":
      return <span className="whitespace-nowrap">{getBudgetStatusLabel(p.budgetStatus)}</span>;
    case "source":
      return sourceLabel(p.source);
    default:
      return "—";
  }
}

function numberOrUndef(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

type FormState = {
  id?: string;
  eventName: string;
  clientName: string;
  city: string;
  state: string;
  eventDate: string;
  status: ProjectStatus;
  size: ProjectSize;
  responsible: string;
  squad: string;
  budgetStatus: BudgetStatus;
  budgetSource: SGFOProject["budgetSource"];
  plannedCost: string;
  approvedCost: string;
  realizedCost: string;
  notes: string;
  source: ProjectSource;
};

function emptyForm(manual = true): FormState {
  return {
    eventName: "",
    clientName: "",
    city: "",
    state: "",
    eventDate: "",
    status: "future",
    size: "Unknown",
    responsible: "",
    squad: "",
    budgetStatus: "missing",
    budgetSource: manual ? "manual" : "none",
    plannedCost: "",
    approvedCost: "",
    realizedCost: "",
    notes: "",
    source: "manual",
  };
}

function projectToForm(p: SGFOProject): FormState {
  return {
    id: p.id,
    eventName: p.eventName,
    clientName: p.clientName ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    eventDate: p.eventDate ? p.eventDate.slice(0, 10) : "",
    status: p.status,
    size: p.size,
    responsible: p.responsible ?? "",
    squad: p.squad ?? "",
    budgetStatus: p.budgetStatus,
    budgetSource: p.budgetSource,
    plannedCost: p.plannedCost != null && Number.isFinite(p.plannedCost) ? String(p.plannedCost) : "",
    approvedCost: p.approvedCost != null && Number.isFinite(p.approvedCost) ? String(p.approvedCost) : "",
    realizedCost: p.realizedCost != null && Number.isFinite(p.realizedCost) ? String(p.realizedCost) : "",
    notes: p.notes ?? "",
    source: p.source,
  };
}

function Card({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div
      className="relative rounded-xl p-4"
      style={{
        background: "rgba(4,12,26,0.8)",
        border: `1px solid ${S.border}`,
        boxShadow: "0 0 20px rgba(0,0,0,0.3)",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: S.muted }}>
        {title}
      </p>
      <p className="mt-1.5 text-xl font-bold tabular-nums" style={{ color: S.text }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: S.dim }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const [store, setStore] = useState<ProjectsStore>(EMPTY_PROJECTS_STORE);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<ProjectStatus | "all">("all");
  const [fSize, setFSize] = useState<ProjectSize | "all">("all");
  const [fBudget, setFBudget] = useState<BudgetStatus | "all">("all");
  const [fSource, setFSource] = useState<ProjectSource | "all">("all");
  const [modal, setModal] = useState<"off" | "create" | "edit">("off");
  const [editingBase, setEditingBase] = useState<SGFOProject | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [seedMsg, setSeedMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState("");
  const [syncDebug, setSyncDebug] = useState<{ colNames: string[]; detectedDateCol: string | null; autoParamId: string | null; rawCount: number; parsedDateCount: number; filteredCount: number; dateSamples: unknown[]; parsedSamples: unknown[] } | null>(null);
  const [syncRange, setSyncRange] = useState(() => getDefaultMetabaseSyncDateRange());
  const [metabaseConfigured, setMetabaseConfigured] = useState<boolean | null>(null);
  const [metabaseMissing, setMetabaseMissing] = useState<string[]>([]);
  const [metabaseStatusError, setMetabaseStatusError] = useState(false);
  const showDevTools =
    process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_SGFO_DEBUG === "1";

  useEffect(() => {
    const s = getProjectsStore();
    startTransition(() => {
      setStore(s);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await fetch("/api/projects/metabase/status", { cache: "no-store" });
        if (!c) setMetabaseStatusError(!r.ok);
        const j = (await r.json()) as { configured?: boolean; missing?: string[] };
        if (c) return;
        if (!r.ok) {
          setMetabaseConfigured(false);
          setMetabaseMissing([]);
          return;
        }
        setMetabaseConfigured(!!j.configured);
        setMetabaseMissing(Array.isArray(j.missing) ? j.missing : []);
      } catch {
        if (!c) {
          setMetabaseStatusError(true);
          setMetabaseConfigured(false);
          setMetabaseMissing([]);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const refresh = () => setStore(getProjectsStore());

  /** Só início e fim válidos (AAAA-MM-DD) alinham total + tabela ao “período” (como a sync). */
  const periodBounds = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(syncRange.from) || !/^\d{4}-\d{2}-\d{2}$/.test(syncRange.to)) {
      return null;
    }
    return orderDateRange(syncRange.from, syncRange.to);
  }, [syncRange.from, syncRange.to]);

  const rangeMatch = useMemo(() => {
    if (!periodBounds) {
      const w = store.projects.filter((p) => projectHasSgfoBudget(p)).length;
      return {
        from: syncRange.from,
        to: syncRange.to,
        eventsInRange: store.projects.length,
        withBudgetInRange: w,
      };
    }
    return matchDateRangeProjectsVsBudget(store.projects, periodBounds.from, periodBounds.to);
  }, [store.projects, periodBounds, syncRange.from, syncRange.to]);

  const projectsInSelectedPeriod = useMemo(() => {
    if (!periodBounds) return store.projects;
    const { from, to } = periodBounds;
    return store.projects.filter((p) => {
      const start = p.eventDate;
      const startIn = !!start && start >= from && start <= to;
      return startIn;
    });
  }, [store.projects, periodBounds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projectsInSelectedPeriod.filter((p) => {
      if (fStatus !== "all" && p.status !== fStatus) return false;
      if (fSize !== "all" && p.size !== fSize) return false;
      if (fBudget !== "all" && p.budgetStatus !== fBudget) return false;
      if (fSource !== "all" && p.source !== fSource) return false;
      if (!q) return true;
      return (
        (p.eventName && p.eventName.toLowerCase().includes(q)) ||
        (p.clientName && p.clientName.toLowerCase().includes(q))
      );
    });
  }, [projectsInSelectedPeriod, search, fStatus, fSize, fBudget, fSource]);

  function onClearData() {
    if (typeof window !== "undefined" && window.confirm("Apagar todos os projetos do armazenamento local?")) {
      window.localStorage.removeItem("sgfo.projects.v1");
      refresh();
    }
  }

  function onSeed() {
    const { added, total } = seedMockProjectsIfEmpty();
    refresh();
    if (added === 0) {
      setSeedMsg(`Já estavam carregados. Total: ${total} projeto(s).`);
    } else {
      setSeedMsg(`Adicionados ${added} mock(s). Total: ${total}.`);
    }
    setTimeout(() => setSeedMsg(""), 4000);
  }

  async function onSyncMetabase() {
    if (metabaseConfigured === false) {
      setSyncErr("Configure o Metabase nas variáveis do servidor (Vercel) para sincronizar.");
      return;
    }
    setSyncing(true);
    setSyncErr("");
    setSyncDebug(null);
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(syncRange.from) || !/^\d{4}-\d{2}-\d{2}$/.test(syncRange.to)) {
        setSyncErr("Defina data início e fim.");
        return;
      }
      const headers: HeadersInit = { Accept: "application/json" };
      const t = process.env.NEXT_PUBLIC_METABASE_SYNC;
      if (t) (headers as Record<string, string>)["x-sgfo-sync"] = t;
      const { from, to } = orderDateRange(syncRange.from, syncRange.to);
      const q = new URLSearchParams({ from, to });
      const r = await fetch(`/api/projects/metabase?${q.toString()}`, { method: "GET", headers, cache: "no-store" });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        projects?: SGFOProject[];
        syncedAt?: string;
        count?: number;
        _debug?: { colNames: string[]; detectedDateCol: string | null; autoParamId: string | null; rawCount: number };
      };
      if (j._debug) {
        const d = j._debug as Record<string, unknown>;
        setSyncDebug({
          colNames: (d.colNames as string[]) ?? [],
          detectedDateCol: (d.detectedDateCol as string | null) ?? null,
          autoParamId: (d.autoParamId as string | null) ?? null,
          rawCount: (d.rawCount as number) ?? 0,
          parsedDateCount: (d.parsedDateCount as number) ?? 0,
          filteredCount: j.count ?? 0,
          dateSamples: (d.dateSamples as unknown[]) ?? [],
          parsedSamples: (d.parsedSamples as unknown[]) ?? [],
        });
      }
      if (!r.ok || !j.ok) {
        setSyncErr((typeof j.message === "string" && j.message) || j.error || `Falha (${r.status})`);
        return;
      }
      if (!j.syncedAt || !Array.isArray(j.projects)) {
        setSyncErr("Resposta inválida do servidor.");
        return;
      }
      const applied = applyMetabaseSync(j.projects, j.syncedAt);
      if (!applied.success) {
        setSyncErr("Metabase devolveu 0 linhas — ajuste o intervalo ou a coluna de data.");
        return;
      }
      refresh();
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : "Erro de rede");
    } finally {
      setSyncing(false);
    }
  }

  function onOpenCreate() {
    setForm(emptyForm(true));
    setEditingBase(null);
    setModal("create");
  }

  function onOpenEdit(p: SGFOProject) {
    setEditingBase(p);
    setForm(projectToForm(p));
    setModal("edit");
  }

  function onSave() {
    if (modal === "create") {
      if (!form.eventName.trim()) return;
      const t = new Date().toISOString();
      const proj: SGFOProject = {
        id: makeProjectId({ eventName: form.eventName }),
        source: "manual",
        eventName: form.eventName.trim(),
        clientName: form.clientName.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        eventDate: form.eventDate.trim() || undefined,
        status: form.status,
        size: form.size,
        responsible: form.responsible.trim() || undefined,
        squad: form.squad.trim() || undefined,
        budgetStatus: form.budgetStatus,
        budgetSource: form.budgetSource,
        plannedCost: numberOrUndef(form.plannedCost),
        approvedCost: numberOrUndef(form.approvedCost),
        realizedCost: numberOrUndef(form.realizedCost),
        notes: form.notes.trim() || undefined,
        createdAt: t,
        updatedAt: t,
      };
      upsertProject(proj);
    } else if (modal === "edit" && editingBase) {
      if (editingBase.source === "metabase") {
        const patch: Partial<SGFOProject> = {
          size: form.size,
          responsible: form.responsible.trim() || undefined,
          squad: form.squad.trim() || undefined,
          budgetStatus: form.budgetStatus,
          budgetSource: form.budgetSource,
          plannedCost: numberOrUndef(form.plannedCost),
          approvedCost: numberOrUndef(form.approvedCost),
          realizedCost: numberOrUndef(form.realizedCost),
          notes: form.notes.trim() || undefined,
        };
        updateProject(editingBase.id, patch);
      } else {
        const t = new Date().toISOString();
        const p: SGFOProject = {
          ...editingBase,
          id: editingBase.id,
          source: "manual",
          eventName: form.eventName.trim() || "(sem nome)",
          clientName: form.clientName.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          eventDate: form.eventDate.trim() || undefined,
          status: form.status,
          size: form.size,
          responsible: form.responsible.trim() || undefined,
          squad: form.squad.trim() || undefined,
          budgetStatus: form.budgetStatus,
          budgetSource: form.budgetSource,
          plannedCost: numberOrUndef(form.plannedCost),
          approvedCost: numberOrUndef(form.approvedCost),
          realizedCost: numberOrUndef(form.realizedCost),
          notes: form.notes.trim() || undefined,
          createdAt: editingBase.createdAt,
          updatedAt: t,
        };
        upsertProject(p);
      }
    }
    setModal("off");
    setEditingBase(null);
    refresh();
  }

  function onDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Excluir este projeto?")) return;
    deleteProject(id);
    refresh();
  }

  if (!ready) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center" style={{ background: S.bg, color: S.muted }}>
        Carregando…
      </div>
    );
  }

  const isMetabaseEdit = modal === "edit" && editingBase?.source === "metabase";
  const isManualEdit = modal === "edit" && editingBase?.source === "manual";

  return (
    <div
      className="min-h-screen w-full p-4 sm:p-6"
      style={{ background: S.bg, color: S.text }}
    >
      <div className="max-w-[1600px] mx-auto space-y-5">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: S.text, textShadow: `0 0 24px ${S.accent}30` }}
          >
            Projetos
          </h1>
          <p className="text-sm mt-1" style={{ color: S.muted }}>
            A tabela mostra todos os projetos importados. O filtro de data é aplicado pelo próprio card no Metabase — o SGFO importa o que o Metabase retorna. Orçamento vem apenas do SGFO (Excel / edição manual).
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card
            title="Total de projetos"
            value={store.projects.length}
            sub={store.lastSyncAt ? `Sync: ${new Date(store.lastSyncAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Sem sync ainda"}
          />
          <Card title="Sem orçamento" value={store.projects.filter(p => p.budgetStatus === "missing").length} />
          <Card
            title="Sem OS"
            value={store.projects.filter((p) => !p.contractId || !p.contractId.trim()).length}
            sub={`de ${store.projects.length} eventos`}
          />
          <Card
            title="Com orçamento (SGFO)"
            value={rangeMatch.withBudgetInRange}
            sub={
              periodBounds
                ? `${formatDate(periodBounds.from)} — ${formatDate(periodBounds.to)}`
                : undefined
            }
          />
        </div>

        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "rgba(4,12,26,0.5)",
            border: `1px solid ${S.border}`,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: S.dim }}>
            Ações
          </p>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
            <div className="flex flex-wrap items-end gap-2">
              {showDevTools && (
                <>
                  <button
                    type="button"
                    onClick={onSeed}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition"
                    style={{ background: S.inputBg, border: `1px solid ${S.border}`, color: S.muted }}
                  >
                    Carregar mocks
                  </button>
                  <button
                    type="button"
                    onClick={onClearData}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition"
                    style={{ background: S.inputBg, border: `1px solid rgba(248,113,113,0.3)`, color: "#f87171" }}
                  >
                    Limpar dados
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onOpenCreate}
                className="px-3 py-2 rounded-lg text-sm font-bold"
                style={{ background: `${S.accent}20`, color: S.accent, border: `1px solid ${S.accent}45` }}
              >
                Novo projeto
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="flex flex-col min-w-[140px]">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: S.dim }}>
                  Início (período sync)
                </span>
                <input
                  type="date"
                  value={syncRange.from}
                  onChange={(e) => setSyncRange((s) => ({ ...s, from: e.target.value }))}
                  className="mt-0.5 rounded-lg px-2 py-1.5 text-sm"
                  style={inputStyle()}
                  title="Inclusivo — enviado na sincronização com o Metabase."
                />
              </div>
              <div className="flex flex-col min-w-[140px]">
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: S.dim }}>
                  Fim (período sync)
                </span>
                <input
                  type="date"
                  value={syncRange.to}
                  onChange={(e) => setSyncRange((s) => ({ ...s, to: e.target.value }))}
                  className="mt-0.5 rounded-lg px-2 py-1.5 text-sm"
                  style={inputStyle()}
                  title="Inclusivo — enviado na sincronização com o Metabase."
                />
              </div>
              <button
                type="button"
                onClick={onSyncMetabase}
                disabled={syncing || metabaseConfigured !== true}
                className="px-3 py-2 rounded-lg text-sm font-medium transition disabled:cursor-not-allowed"
                style={{
                  background: "rgba(6,214,245,0.08)",
                  border: `1px solid rgba(6,214,245,0.25)`,
                  color: "#5ad4e6",
                  opacity: metabaseConfigured === false ? 0.5 : 1,
                }}
                title={
                  metabaseConfigured === false
                    ? "Metabase não configurado no servidor (variáveis METABASE_*)"
                    : undefined
                }
              >
                {metabaseConfigured === null
                  ? "A verificar…"
                  : syncing
                    ? "A sincronizar…"
                    : "Sincronizar com Metabase"}
              </button>
            </div>
          </div>
          {metabaseConfigured === false && (
            <p className="text-sm rounded-lg p-3 leading-relaxed" style={{ background: "rgba(6,214,245,0.06)", border: "1px solid rgba(6,214,245,0.2)", color: S.muted }}>
              {metabaseStatusError ? (
                <>
                  Não foi possível verificar a configuração do Metabase (rede ou servidor). Recarregue a
                  página; se persistir, confirme que a API <span style={{ color: S.text }}>/api/projects/metabase/status</span>{" "}
                  responde no mesmo domínio.
                </>
              ) : (
                <>
                  A sincronização com o Metabase não está ativa neste ambiente: o servidor não vê todas
                  as variáveis necessárias. No painel do projeto (ex.: Vercel → Settings → Environment
                  Variables), adicione-as para o ambiente certo{" "}
                  <strong style={{ color: S.text }}>(Production</strong> se usa o URL de produção;{" "}
                  <strong style={{ color: S.text }}>Preview</strong> para branches de PR) e faça um{" "}
                  <strong style={{ color: S.text }}>Redeploy</strong> se acabou de criar as variáveis.
                </>
              )}
              {!metabaseStatusError && metabaseMissing.length > 0 && (
                <>
                  {" "}
                  Em falta no servidor:{" "}
                  {metabaseMissing.map((name, i) => (
                    <span key={name}>
                      {i > 0 ? ", " : ""}
                      <span style={{ color: S.text }}>{name}</span>
                    </span>
                  ))}
                  .
                </>
              )}
              {!metabaseStatusError && metabaseMissing.length === 0 && (
                <>
                  {" "}
                  Defina <span style={{ color: S.text }}>METABASE_URL</span>,{" "}
                  <span style={{ color: S.text }}>METABASE_API_KEY</span> e{" "}
                  <span style={{ color: S.text }}>METABASE_QUESTION_ID</span> (valores não vazios, sem
                  aspas a mais no painel).
                </>
              )}{" "}
              Pode continuar a usar <strong style={{ color: S.text }}>Novo projeto</strong> e preencher
              os dados no SGFO.
            </p>
          )}
          <div className="w-full flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 text-xs" style={{ color: S.muted }}>
            {store.lastSyncAt && (
              <span>
                Última sincronização:{" "}
                <span className="tabular-nums">
                  {new Date(store.lastSyncAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              </span>
            )}
            {syncErr && <span className="sm:ml-2" style={{ color: "#f87171" }}>{syncErr}</span>}
          </div>
          {seedMsg && <p className="text-sm w-full" style={{ color: S.muted }}>{seedMsg}</p>}
          {showDevTools && syncDebug && (
            <div className="w-full rounded-lg p-3 text-xs space-y-1" style={{ background: "rgba(6,214,245,0.05)", border: "1px solid rgba(6,214,245,0.15)", color: S.muted }}>
              <p><span style={{ color: S.text }}>Linhas brutas:</span> {syncDebug.rawCount} · <span style={{ color: S.text }}>Com data parseada:</span> <span style={{ color: syncDebug.parsedDateCount === 0 ? "#f87171" : "#4ade80" }}>{syncDebug.parsedDateCount}</span> · <span style={{ color: S.text }}>Após filtro:</span> <span style={{ color: syncDebug.filteredCount === syncDebug.rawCount ? "#f87171" : "#4ade80" }}>{syncDebug.filteredCount}</span></p>
              <p><span style={{ color: S.text }}>Coluna de data detectada:</span> {syncDebug.detectedDateCol ?? <span style={{ color: "#f87171" }}>nenhuma — adicione METABASE_DATE_COLUMN=nome_da_coluna no .env</span>}</p>
              <p><span style={{ color: S.text }}>Parâmetro de data no card:</span> {syncDebug.autoParamId ?? <span style={{ color: "#fbbf24" }}>nenhum</span>}</p>
              {syncDebug.dateSamples.length > 0 && (
                <p><span style={{ color: S.text }}>Valores brutos (col. data, 5 linhas):</span> <span style={{ color: "#fbbf24" }}>{syncDebug.dateSamples.map(String).join(" | ")}</span></p>
              )}
              {syncDebug.parsedSamples.length > 0 && (
                <p><span style={{ color: S.text }}>Datas parseadas (5 linhas):</span> <span style={{ color: syncDebug.parsedSamples.every(v => v === null) ? "#f87171" : "#4ade80" }}>{syncDebug.parsedSamples.map(v => v ?? "null").join(" | ")}</span></p>
              )}
              <p style={{ color: S.dim }}>Colunas: {syncDebug.colNames.join(" · ")}</p>
            </div>
          )}
        </div>

        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(4,12,26,0.4)",
            border: `1px solid ${S.border}`,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: S.dim }}>
            Filtros
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="min-w-0 sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.dim }}>
                Busca
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Evento ou cliente"
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle()}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.dim }}>
                Status
              </label>
              <select
                className="mt-1 w-full min-w-[120px] rounded-lg px-2 py-2 text-sm"
                style={inputStyle()}
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as typeof fStatus)}
              >
                <option value="all">Todos</option>
                {STATUS_OPTS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.dim }}>
                Tamanho
              </label>
              <select
                className="mt-1 w-full min-w-[100px] rounded-lg px-2 py-2 text-sm"
                style={inputStyle()}
                value={fSize}
                onChange={(e) => setFSize(e.target.value as typeof fSize)}
              >
                <option value="all">Todos</option>
                {SIZE_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.dim }}>
                Orçamento
              </label>
              <select
                className="mt-1 w-full min-w-[140px] rounded-lg px-2 py-2 text-sm"
                style={inputStyle()}
                value={fBudget}
                onChange={(e) => setFBudget(e.target.value as typeof fBudget)}
              >
                <option value="all">Todos</option>
                {BUDGET_OPTS.map((b) => (
                  <option key={b} value={b}>
                    {getBudgetStatusLabel(b)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: S.dim }}>
                Origem
              </label>
              <select
                className="mt-1 w-full min-w-[120px] rounded-lg px-2 py-2 text-sm"
                style={inputStyle()}
                value={fSource}
                onChange={(e) => setFSource(e.target.value as typeof fSource)}
              >
                {SOURCE_FILTER.map((o) => (
                  <option key={o} value={o}>
                    {o === "all" ? "Todas" : sourceLabel(o as ProjectSource)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${S.border}` }}>
          <table className="w-full min-w-[1500px] text-sm text-left">
            <thead>
              <tr style={{ color: S.muted, borderBottom: `1px solid ${S.border}` }}>
                {PROJECT_LIST_HEADERS.map((h) => (
                  <th
                    key={h.key}
                    className={`p-2.5 font-bold text-[10px] uppercase tracking-wide whitespace-nowrap ${"align" in h && h.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${S.border}` }} className="align-middle">
                  {PROJECT_LIST_HEADERS.map((h) => {
                    if (h.key === "actions") {
                      return (
                        <td key={h.key} className="p-2.5">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs font-semibold underline"
                              style={{ color: S.accent }}
                              onClick={() => onOpenEdit(p)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold"
                              style={{ color: "#f87171" }}
                              onClick={() => onDelete(p.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      );
                    }
                    const isEvent = h.key === "eventName";
                    const isNum = "align" in h && h.align === "right";
                    return (
                      <td
                        key={h.key}
                        className={`p-2.5 ${isNum ? "text-right" : ""} ${isEvent ? "font-medium" : ""}`}
                        style={{ color: isEvent ? S.text : S.muted }}
                      >
                        {projectListCell(p, h.key as ProjectListDataKey)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: S.muted }}>
            Nenhum projeto com os filtros atuais.
          </p>
        )}
      </div>

      {modal !== "off" && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { setModal("off"); setEditingBase(null); }}
        >
          <div
            className="w-full max-w-lg sm:max-w-2xl max-h-[min(100vh,720px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
            style={{ background: S.bg, border: `1px solid ${S.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold" style={{ color: S.text }}>
              {modal === "create" ? "Novo projeto manual" : "Editar projeto"}
            </h2>
            {isMetabaseEdit && (
              <p className="text-xs mt-2" style={{ color: S.muted }}>
                Dados de evento/integração vêm do import (não editáveis). Ajuste apenas o enriquecimento
                gerencial.
              </p>
            )}

            <div className="mt-4 space-y-3">
              {modal === "create" && (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field
                      label="Evento *"
                      value={form.eventName}
                      onChange={(v) => setForm((f) => ({ ...f, eventName: v }))}
                    />
                    <Field
                      label="Cliente"
                      value={form.clientName}
                      onChange={(v) => setForm((f) => ({ ...f, clientName: v }))}
                    />
                    <Field
                      label="Cidade"
                      value={form.city}
                      onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                    />
                    <Field
                      label="UF"
                      value={form.state}
                      onChange={(v) => setForm((f) => ({ ...f, state: v }))}
                    />
                    <div>
                      <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                        Data do evento
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
                        style={inputStyle()}
                        value={form.eventDate}
                        onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                        Status
                      </label>
                      <select
                        className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
                        style={inputStyle()}
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
                      >
                        {STATUS_OPTS.map((o) => (
                          <option key={o.v} value={o.v}>
                            {o.l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {isMetabaseEdit && (
                <div
                  className="rounded-lg p-3 text-sm"
                  style={{ background: S.inputBg, color: S.muted, border: `1px solid ${S.border}` }}
                >
                  <p>
                    <strong style={{ color: S.text }}>{editingBase?.eventName}</strong>
                  </p>
                  <p>Cliente: {editingBase?.clientName ?? "—"}</p>
                  <p>Local: {[editingBase?.city, editingBase?.state].filter(Boolean).join(" / ") || "—"}</p>
                  <p>Data: {formatDate(editingBase?.eventDate)}</p>
                  <p>Status: {editingBase ? getProjectStatusLabel(editingBase.status) : "—"}</p>
                </div>
              )}

              {isManualEdit && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field
                    label="Evento"
                    value={form.eventName}
                    onChange={(v) => setForm((f) => ({ ...f, eventName: v }))}
                  />
                  <Field
                    label="Cliente"
                    value={form.clientName}
                    onChange={(v) => setForm((f) => ({ ...f, clientName: v }))}
                  />
                  <Field
                    label="Cidade"
                    value={form.city}
                    onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                  />
                  <Field
                    label="UF"
                    value={form.state}
                    onChange={(v) => setForm((f) => ({ ...f, state: v }))}
                  />
                  <div>
                    <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                      Data
                    </label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
                      style={inputStyle()}
                      value={form.eventDate}
                      onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                      Status
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
                      style={inputStyle()}
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
                    >
                      {STATUS_OPTS.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                    Tamanho
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
                    style={inputStyle()}
                    value={form.size}
                    onChange={(e) => setForm((f) => ({ ...f, size: e.target.value as ProjectSize }))}
                  >
                    {SIZE_OPTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Responsável"
                  value={form.responsible}
                  onChange={(v) => setForm((f) => ({ ...f, responsible: v }))}
                />
                <Field
                  label="Squad"
                  value={form.squad}
                  onChange={(v) => setForm((f) => ({ ...f, squad: v }))}
                />
                <div>
                  <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                    Status de orçamento
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
                    style={inputStyle()}
                    value={form.budgetStatus}
                    onChange={(e) => setForm((f) => ({ ...f, budgetStatus: e.target.value as BudgetStatus }))}
                  >
                    {BUDGET_OPTS.map((b) => (
                      <option key={b} value={b}>
                        {getBudgetStatusLabel(b)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                    Origem orçamento
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
                    style={inputStyle()}
                    value={form.budgetSource}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        budgetSource: e.target.value as SGFOProject["budgetSource"],
                      }))
                    }
                  >
                    {BUDGET_SOURCE_OPTS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Previsto (R$)"
                  value={form.plannedCost}
                  onChange={(v) => setForm((f) => ({ ...f, plannedCost: v }))}
                />
                <Field
                  label="Aprovado (R$)"
                  value={form.approvedCost}
                  onChange={(v) => setForm((f) => ({ ...f, approvedCost: v }))}
                />
                <Field
                  label="Realizado (R$)"
                  value={form.realizedCost}
                  onChange={(v) => setForm((f) => ({ ...f, realizedCost: v }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
                  Observações
                </label>
                <textarea
                  className="mt-1 w-full min-h-[88px] rounded-lg px-3 py-2 text-sm"
                  style={inputStyle()}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { setModal("off"); setEditingBase(null); }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: S.muted, background: S.inputBg, border: `1px solid ${S.border}` }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSave}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: `${S.accent}20`, color: S.accent, border: `1px solid ${S.accent}45` }}
                disabled={modal === "create" && !form.eventName.trim()}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase" style={{ color: S.dim }}>
        {label}
      </label>
      <input
        className="mt-1 w-full rounded-lg px-2 py-2 text-sm"
        style={inputStyle()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
