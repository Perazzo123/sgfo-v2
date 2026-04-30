"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { filterCostProjectsForSession } from "@/lib/auth/filters";
import {
  BUDGET_CATEGORY_LABELS,
  EMPTY_BUDGET,
  EMPTY_PROJECTS_STORE,
  makeProjectId,
  type Budget,
  type BudgetBreakdown,
  type BudgetCategoryKey,
  type CostEntry,
  type Project,
  type ProjectsStore,
} from "@/lib/costs/types";
import {
  closeProject,
  getActiveProject,
  loadProjectsStore,
  removeProject,
  reopenProject,
  saveProjectsStore,
  setActiveProject,
  upsertProject,
} from "@/lib/costs/storage";
import {
  extractBudgetFromXlsx,
  type BudgetXlsxExtraction,
  type BudgetXlsxOption,
} from "@/lib/costs/xlsxImport";
import {
  extractFinancialClosingFromPdf,
  type FinancialClosingExtraction,
} from "@/lib/costs/financialClosingImport";

const CATEGORIES = ["Mão de Obra", "Transporte", "Hospedagem", "Alimentação", "Frete", "Outros"];

const S = {
  bg: "#020810",
  surface: "rgba(4,12,26,0.97)",
  surfaceHigh: "rgba(6,16,32,0.97)",
  border: "#0d2040",
  borderSub: "#081630",
  text: "#c8e8ff",
  muted: "#4a7a9a",
  dim: "#2a5070",
  accent: "#06d6f5",
  accentBg: "rgba(6,214,245,0.05)",
  accentBorder: "rgba(6,214,245,0.15)",
  amber: "#ffb700",
  amberLight: "#ffcc33",
  amberBg: "rgba(255,183,0,0.06)",
  amberBorder: "rgba(255,183,0,0.2)",
  green: "#00ff88",
  greenBg: "rgba(0,255,136,0.05)",
  greenBorder: "rgba(0,255,136,0.2)",
  red: "#ff4466",
  redBg: "rgba(255,68,102,0.05)",
  redBorder: "rgba(255,68,102,0.2)",
  inputBg: "#050e1f",
};

function GlowSection({
  accent = "#06d6f5",
  className = "",
  style = {},
  children,
}: {
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const br = 12;
  const cs = 14;
  return (
    <div
      className={`relative ${className}`}
      style={{
        background: "rgba(4,12,26,0.97)",
        border: `1px solid ${accent}20`,
        borderRadius: br,
        boxShadow: `0 0 30px ${accent}0e, 0 4px 60px rgba(0,0,0,0.5)`,
        ...style,
      }}
    >
      {[
        { top: 0, left: 0, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}`, borderTopLeftRadius: br },
        { top: 0, right: 0, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, borderTopRightRadius: br },
        { bottom: 0, left: 0, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}`, borderBottomLeftRadius: br },
        { bottom: 0, right: 0, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, borderBottomRightRadius: br },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: cs, height: cs, ...s }} />
      ))}
      {children}
    </div>
  );
}

const CAT_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  "Mão de Obra": { bg: "#0d1829", color: "#60a5fa", border: "#1a2e4a" },
  Transporte: { bg: "#0d1a29", color: "#38bdf8", border: "#1a3045" },
  Hospedagem: { bg: "#170d29", color: "#a78bfa", border: "#2a1845" },
  Alimentação: { bg: "#211c0e", color: "#fbbf24", border: "#3a2e0f" },
  Frete: { bg: "#0d1f18", color: "#34d399", border: "#1a3a2a" },
  Outros: { bg: "#1d2436", color: "#6b7fa3", border: "#2a3550" },
};

function projectLabel(p: Project): string {
  const name = p.budget.eventName || "(sem nome)";
  return p.budget.contractId ? `${name} · ${p.budget.contractId}` : name;
}

function projectRealized(p: Project): number {
  return p.entries.reduce((sum, e) => sum + e.amount, 0);
}

function genEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Valor em R$ com vírgula ou ponto decimal (ex.: 1.234,56 ou 1234.56). */
function parseAmountBr(raw: string): number {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return NaN;
  const only = t.replace(/[^\d,.-]/g, "");
  if (!only || only === "-" || only === ",") return NaN;
  if (only.includes(",") && (!only.includes(".") || only.lastIndexOf(",") > only.lastIndexOf("."))) {
    return Number(only.replace(/\./g, "").replace(",", "."));
  }
  return Number(only.replace(/,/g, ""));
}

const OUTSIDE_BUDGET_DEFAULT_JUSTIFICATION =
  "Aprovado fora do orçamento — demanda necessária operacionalmente.";

const CLOSING_AUTO_JUSTIFICATION = "auto:fechamento-financeiro";
const CLOSING_TEAM_DESC = "Fechamento financeiro · Equipe de campo (modelo Zig)";
const CLOSING_OTHER_DESC = "Fechamento financeiro · DEMAIS DESPESAS";

export default function CostsPage() {
  const { session } = useAuth();
  const [store, setStore] = useState<ProjectsStore>(EMPTY_PROJECTS_STORE);
  const [ready, setReady] = useState(false);
  const headerImportFileRef = useRef<HTMLInputElement>(null);
  const headerClosingFileRef = useRef<HTMLInputElement>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [closingImportBusy, setClosingImportBusy] = useState(false);
  /** Alimenta o editor (escolha Zig x Cliente) após importar pelo cabeçalho. */
  const [lastImportExtraction, setLastImportExtraction] = useState<BudgetXlsxExtraction | null>(null);
  const [lastClosingExtraction, setLastClosingExtraction] =
    useState<FinancialClosingExtraction | null>(null);

  useEffect(() => {
    setStore(loadProjectsStore());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveProjectsStore(store);
  }, [store, ready]);

  const activeProject = useMemo(() => getActiveProject(store), [store]);
  const openProjects = useMemo(
    () => store.projects.filter((p) => p.status === "open"),
    [store.projects]
  );
  const closedProjects = useMemo(
    () => store.projects.filter((p) => p.status === "closed"),
    [store.projects]
  );
  const openVisible = useMemo(
    () => filterCostProjectsForSession(openProjects, session),
    [openProjects, session]
  );
  const closedVisible = useMemo(
    () => filterCostProjectsForSession(closedProjects, session),
    [closedProjects, session]
  );

  useEffect(() => {
    if (!ready) return;
    const openV = filterCostProjectsForSession(
      store.projects.filter((p) => p.status === "open"),
      session
    );
    const cur = getActiveProject(store);
    if (cur && openV.some((p) => p.id === cur.id)) return;
    const nextId = openV[0]?.id ?? null;
    if (nextId === store.activeProjectId) return;
    setStore((s) => setActiveProject(s, nextId));
  }, [ready, store.projects, store.activeProjectId, session]);

  const budget = activeProject?.budget ?? null;
  const entries = activeProject?.entries ?? [];

  // Estado do editor / criação de projeto.
  // editingProjectId === undefined: editor fechado.
  // editingProjectId === null: criando um novo projeto (vazio).
  // editingProjectId === string: editando o projeto correspondente.
  const [editingProjectId, setEditingProjectId] = useState<string | null | undefined>(undefined);

  // Form de lançamento (sempre amarrado ao projeto ativo).
  const [category, setCategory] = useState("Mão de Obra");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [entryOutsideBudget, setEntryOutsideBudget] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const consumed = entries.reduce((s, e) => s + e.amount, 0);
  const totalBudget = budget?.total ?? 0;
  const balance = totalBudget - consumed;
  const pct = totalBudget > 0 ? Math.min((consumed / totalBudget) * 100, 100) : 0;
  const isOver = balance < 0;

  const labelToBudgetKey = useMemo(
    () =>
      Object.fromEntries(
        (Object.entries(BUDGET_CATEGORY_LABELS) as [BudgetCategoryKey, string][]).map(
          ([k, l]) => [l, k]
        )
      ) as Record<string, BudgetCategoryKey>,
    []
  );

  const realizedByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries) {
      m[e.category] = (m[e.category] ?? 0) + e.amount;
    }
    return m;
  }, [entries]);

  const realizedOutsideCatalog = useMemo(() => {
    const known = new Set(CATEGORIES);
    let sum = 0;
    for (const [k, v] of Object.entries(realizedByCategory)) {
      if (!known.has(k)) sum += v;
    }
    return sum;
  }, [realizedByCategory]);

  const bolsao = useMemo(() => {
    return closedVisible.reduce(
      (acc, p) => {
        const previsto = p.budget.total ?? 0;
        const realizado = projectRealized(p);
        const saldo = previsto - realizado;
        if (saldo >= 0) acc.sobras += saldo;
        else acc.estouros += Math.abs(saldo);
        acc.liquido += saldo;
        return acc;
      },
      { sobras: 0, estouros: 0, liquido: 0 }
    );
  }, [closedVisible]);

  function clearEntryForm() {
    setCategory("Mão de Obra");
    setDescription("");
    setAmount("");
    setJustification("");
    setEntryOutsideBudget(false);
    setEditingEntryId(null);
  }

  function triggerHeaderImport() {
    headerImportFileRef.current?.click();
  }

  function triggerClosingImport() {
    if (!activeProject) {
      alert("Selecione um projeto antes de importar o Fechamento Financeiro.");
      return;
    }
    headerClosingFileRef.current?.click();
  }

  async function onHeaderImportFile(file: File | null) {
    if (!file) return;
    if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
      alert("Selecione um arquivo .xlsx, .xlsm ou .xls");
      if (headerImportFileRef.current) headerImportFileRef.current.value = "";
      return;
    }
    setImportBusy(true);
    try {
      const ex = await extractBudgetFromXlsx(file);
      await handleImportedExtraction(ex, ex.selectedOptionId ?? undefined);
    } catch (e) {
      setLastImportExtraction(null);
      setLastClosingExtraction(null);
      alert(`Falha ao importar: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    } finally {
      setImportBusy(false);
      if (headerImportFileRef.current) headerImportFileRef.current.value = "";
    }
  }

  function applyFinancialClosingExtraction(ex: FinancialClosingExtraction) {
    if (!activeProject) {
      alert("Selecione um projeto antes de importar o Fechamento Financeiro.");
      return;
    }
    const now = new Date().toISOString();
    const imported: CostEntry[] = [];

    if (ex.entries && ex.entries.length > 0) {
      for (const e of ex.entries) {
        if (!Number.isFinite(e.amount) || e.amount <= 0) continue;
        imported.push({
          id: genEntryId(),
          category: e.category,
          description: `Fechamento financeiro · ${e.label}`,
          amount: Math.abs(e.amount),
          justification: CLOSING_AUTO_JUSTIFICATION,
          createdAt: now,
        });
      }
    }

    /* Fallback: se o servidor não devolveu rubricas, mantém a quebra agregada antiga. */
    if (imported.length === 0) {
      const teamAmt = Math.abs(ex.teamCanto ?? 0);
      const otherAmt = Math.abs(ex.otherExpenses ?? 0);
      if (teamAmt > 0) {
        imported.push({
          id: genEntryId(),
          category: "Mão de Obra",
          description: CLOSING_TEAM_DESC,
          amount: teamAmt,
          justification: CLOSING_AUTO_JUSTIFICATION,
          createdAt: now,
        });
      }
      if (otherAmt > 0) {
        imported.push({
          id: genEntryId(),
          category: "Outros",
          description: CLOSING_OTHER_DESC,
          amount: otherAmt,
          justification: CLOSING_AUTO_JUSTIFICATION,
          createdAt: now,
        });
      }
    }

    setStore((s) => ({
      ...s,
      projects: s.projects.map((p) => {
        if (p.id !== activeProject.id) return p;
        const keep = p.entries.filter((e) => e.justification !== CLOSING_AUTO_JUSTIFICATION);
        return { ...p, entries: [...keep, ...imported] };
      }),
    }));
  }

  async function onHeaderClosingFile(file: File | null) {
    if (!file) return;
    if (!activeProject) {
      alert("Selecione um projeto antes de importar o Fechamento Financeiro.");
      if (headerClosingFileRef.current) headerClosingFileRef.current.value = "";
      return;
    }
    if (!/\.pdf$/i.test(file.name)) {
      alert("Selecione um arquivo .pdf");
      if (headerClosingFileRef.current) headerClosingFileRef.current.value = "";
      return;
    }
    setClosingImportBusy(true);
    try {
      const ex = await extractFinancialClosingFromPdf(file);
      setLastClosingExtraction(ex);
      applyFinancialClosingExtraction(ex);
      if (ex.warnings.length > 0) {
        alert(
          `Fechamento importado com avisos:\n- ${ex.warnings.join("\n- ")}\n\nTotal aplicado no realizado: R$ ${ex.total.toLocaleString("pt-BR")}`
        );
      }
    } catch (e) {
      alert(
        `Falha ao importar Fechamento Financeiro: ${e instanceof Error ? e.message : "erro desconhecido"}`
      );
    } finally {
      setClosingImportBusy(false);
      if (headerClosingFileRef.current) headerClosingFileRef.current.value = "";
    }
  }

  function addEntry() {
    if (!activeProject) {
      alert("Selecione ou crie um projeto antes de adicionar um lançamento.");
      return;
    }
    const d = description.trim();
    if (!d) {
      alert("Preencha a descrição do custo.");
      return;
    }
    let j = justification.trim();
    if (!j && entryOutsideBudget) {
      j = OUTSIDE_BUDGET_DEFAULT_JUSTIFICATION;
    }
    if (!j) {
      alert(
        "Preencha a justificativa (ex.: quem aprovou e por quê) ou marque “Aprovado fora do orçamento” para usar o texto padrão."
      );
      return;
    }
    const n = parseAmountBr(amount);
    if (!Number.isFinite(n) || n <= 0) {
      alert("Informe um valor (R$) válido e maior que zero.");
      return;
    }
    const ob = entryOutsideBudget;
    setStore((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === activeProject.id
          ? {
              ...p,
              entries: editingEntryId
                ? p.entries.map((e) => {
                    if (e.id !== editingEntryId) return e;
                    const { outsideBudget: _drop, ...rest } = e;
                    return {
                      ...rest,
                      category,
                      description: d,
                      amount: n,
                      justification: j,
                      ...(ob ? { outsideBudget: true as const } : {}),
                    };
                  })
                : [
                    ...p.entries,
                    {
                      id: genEntryId(),
                      category,
                      description: d,
                      amount: n,
                      justification: j,
                      createdAt: new Date().toISOString(),
                      ...(ob ? { outsideBudget: true } : {}),
                    } satisfies CostEntry,
                  ],
            }
          : p
      ),
    }));
    clearEntryForm();
  }

  function editEntry(entry: CostEntry) {
    setCategory(entry.category);
    setDescription(entry.description);
    setAmount(String(entry.amount));
    setJustification(entry.justification);
    setEntryOutsideBudget(entry.outsideBudget === true);
    setEditingEntryId(entry.id);
  }

  function selectProject(id: string) {
    setStore((s) => setActiveProject(s, id));
    setEditingProjectId(undefined);
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
    clearEntryForm();
  }

  function openCreate() {
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
    setEditingProjectId(null);
  }

  function openEditActive() {
    if (!activeProject) {
      openCreate();
      return;
    }
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
    setEditingProjectId(activeProject.id);
  }

  function closeEditor() {
    setEditingProjectId(undefined);
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
  }

  function handleSaveBudget(targetId: string | null, b: Budget) {
    const areaZig =
      typeof b.totalZigArea === "number" && Number.isFinite(b.totalZigArea) && b.totalZigArea >= 0
        ? b.totalZigArea
        : Math.max(0, b.total ?? 0);
    const finalBudget: Budget = {
      ...b,
      updatedAt: new Date().toISOString(),
      totalZigArea: areaZig,
    };
    let projectId: string;
    if (targetId === null) {
      projectId = makeProjectId({
        contractId: finalBudget.contractId,
        eventName: finalBudget.eventName,
      });
      // Garante unicidade: se já existir um projeto com esse id, sufixa.
      const exists = store.projects.some((p) => p.id === projectId);
      if (exists) {
        let i = 2;
        while (store.projects.some((p) => p.id === `${projectId}-${i}`)) i++;
        projectId = `${projectId}-${i}`;
      }
    } else {
      projectId = targetId;
    }
    setStore((s) =>
      upsertProject(s, {
        id: projectId,
        budget: finalBudget,
      })
    );
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
    setEditingProjectId(undefined);
  }

  function handleDeleteActive() {
    if (!activeProject) return;
    const ok = confirm(
      `Excluir o projeto "${activeProject.budget.eventName || activeProject.id}" e todos os seus lançamentos?`
    );
    if (!ok) return;
    setStore((s) => removeProject(s, activeProject.id));
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
    setEditingProjectId(undefined);
  }

  function handleCloseActiveBudget() {
    if (!activeProject) return;
    const ok = confirm(
      `Encerrar o orçamento de "${activeProject.budget.eventName || activeProject.id}"? Ele sairá da visão ativa e irá para a tabela de encerrados.`
    );
    if (!ok) return;
    setStore((s) => closeProject(s, activeProject.id));
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
    setEditingProjectId(undefined);
  }

  function handleReopenProject(id: string) {
    setLastImportExtraction(null);
    setLastClosingExtraction(null);
    setStore((s) => reopenProject(s, id));
    setEditingProjectId(id);
  }

  /**
   * Importação XLSX feita aqui (no parent) para fazer upsert no store
   * usando o contractId como chave. Mantém os lançamentos existentes.
   */
  async function handleImportedExtraction(ex: BudgetXlsxExtraction, optionId?: BudgetXlsxOption["id"]) {
    const opt = optionId ? ex.options.find((o) => o.id === optionId) ?? null : null;
    const total = opt ? opt.total : ex.total ?? 0;
    const breakdown = opt ? opt.breakdown : ex.breakdown;
    const zigOpt = ex.options.find((o) => o.id === "zig");
    const cliOpt = ex.options.find((o) => o.id === "cliente");
    const newBudget: Budget = {
      ...EMPTY_BUDGET,
      eventName: ex.eventName ?? "",
      contractId: ex.contractId ?? "",
      startDate: ex.startDate ?? "",
      endDate: ex.endDate ?? "",
      location: ex.location ?? "",
      total,
      breakdown: { ...breakdown },
      source: "xlsx",
      fileName: ex.fileName,
      sourceSheet: ex.sourceSheet ?? undefined,
      updatedAt: new Date().toISOString(),
      totalZigArea: zigOpt ? zigOpt.total : total,
      ...(cliOpt ? { totalClienteAprovado: cliOpt.total } : {}),
    };
    const id = makeProjectId({
      contractId: newBudget.contractId,
      eventName: newBudget.eventName,
    });
    setStore((s) =>
      upsertProject(s, { id, budget: newBudget, status: "open", closedAt: undefined })
    );
    setLastImportExtraction(ex);
    // Foca no projeto recém-importado e abre o editor para permitir ajustes finos.
    setEditingProjectId(id);
  }

  const editorOpen = editingProjectId !== undefined;
  /** Tela de orçamento (KPIs + lançamentos): visível em todo o fluxo, exceto ao **criar** projeto no editor (foco no formulário). */
  const showOrçamentoDashboard = !editorOpen || activeProject;
  const editorBudget: Budget | null = editorOpen
    ? editingProjectId === null
      ? EMPTY_BUDGET
      : (store.projects.find((p) => p.id === editingProjectId)?.budget ?? null)
    : null;

  return (
    <div
      className="min-h-full"
      style={{
        background: "radial-gradient(ellipse at 50% 0%, #082428 0%, #030b18 55%, #020810 100%)",
        color: S.text,
      }}
    >
      <div
        className="px-8 py-5 flex flex-wrap items-start justify-between gap-4"
        style={{
          background: "rgba(3,10,22,0.95)",
          borderBottom: "1px solid rgba(6,214,245,0.1)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1"
            style={{ color: "#ffb700", opacity: 0.75 }}
          >
            SGFO · Módulo
          </p>
          <h1
            className="text-xl font-black tracking-tight"
            style={{ color: "#c8e8ff", textShadow: "0 0 30px rgba(6,214,245,0.25)" }}
          >
            Gestão de Custos
          </h1>
          {activeProject ? (
            <p className="text-xs mt-1" style={{ color: S.accent, opacity: 0.7 }}>
              {activeProject.budget.eventName || "(sem nome)"}
              {activeProject.budget.contractId ? ` · Contrato ${activeProject.budget.contractId}` : ""}
              {activeProject.budget.startDate || activeProject.budget.endDate
                ? ` · ${activeProject.budget.startDate || "?"} → ${activeProject.budget.endDate || "?"}`
                : ""}
            </p>
          ) : (
            <p className="text-xs mt-1" style={{ color: S.accent, opacity: 0.5 }}>
              Nenhum projeto cadastrado. Crie um ou importe a planilha de orçamento.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={headerImportFileRef}
            type="file"
            className="hidden"
            accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => onHeaderImportFile(e.target.files?.[0] ?? null)}
            aria-hidden
          />
          <input
            ref={headerClosingFileRef}
            type="file"
            className="hidden"
            accept=".pdf,application/pdf"
            onChange={(e) => onHeaderClosingFile(e.target.files?.[0] ?? null)}
            aria-hidden
          />
          <ProjectSelector
            projects={openVisible}
            activeProjectId={activeProject?.id ?? null}
            onChange={selectProject}
            onCreate={openCreate}
          />
          <button
            type="button"
            onClick={triggerHeaderImport}
            disabled={importBusy}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg"
            style={{
              background: S.amberBg,
              color: S.amber,
              border: `1px solid ${S.amberBorder}`,
              boxShadow: `0 0 14px rgba(255,183,0,0.12)`,
              opacity: importBusy ? 0.65 : 1,
              cursor: importBusy ? "wait" : "pointer",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {importBusy ? "Importando…" : "Importar orçamento"}
          </button>
          <button
            type="button"
            onClick={triggerClosingImport}
            disabled={closingImportBusy || !activeProject}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg"
            style={{
              background: S.greenBg,
              color: S.green,
              border: `1px solid ${S.greenBorder}`,
              boxShadow: `0 0 14px rgba(0,255,136,0.12)`,
              opacity: closingImportBusy || !activeProject ? 0.65 : 1,
              cursor: closingImportBusy || !activeProject ? "not-allowed" : "pointer",
            }}
            title={!activeProject ? "Selecione um projeto para importar o fechamento." : undefined}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {closingImportBusy ? "Importando…" : "Importar fechamento"}
          </button>
          {activeProject ? (
            <>
              <button
                type="button"
                onClick={openEditActive}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{
                  background: S.accentBg,
                  color: S.accent,
                  border: `1px solid ${S.accentBorder}`,
                }}
              >
                {editorOpen && editingProjectId === activeProject.id
                  ? "Fechar editor"
                  : "Editar orçamento"}
              </button>
              <button
                type="button"
                onClick={handleCloseActiveBudget}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{
                  background: S.greenBg,
                  color: S.green,
                  border: `1px solid ${S.greenBorder}`,
                }}
              >
                Encerrar orçamento
              </button>
              <button
                type="button"
                onClick={handleDeleteActive}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{
                  background: S.redBg,
                  color: S.red,
                  border: `1px solid ${S.redBorder}`,
                }}
              >
                Excluir projeto
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {editorOpen && editorBudget ? (
          <BudgetEditor
            mode={editingProjectId === null ? "create" : "edit"}
            value={editorBudget}
            extractionFromParent={lastImportExtraction}
            onSave={(b) => handleSaveBudget(editingProjectId ?? null, b)}
            onCancel={closeEditor}
            onImported={handleImportedExtraction}
          />
        ) : null}

        {showOrçamentoDashboard ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <GlowSection accent={S.accent}>
                <div className="p-5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: S.accent, opacity: 0.65 }}>
                    Previsto (Budget)
                  </p>
                  <p
                    className="text-2xl font-black tabular-nums leading-none"
                    style={{ color: S.accent, textShadow: `0 0 18px ${S.accent}99, 0 0 48px ${S.accent}44` }}
                  >
                    {totalBudget > 0 ? `R$ ${totalBudget.toLocaleString("pt-BR")}` : "—"}
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: S.accent, opacity: 0.5 }}>
                    {budget
                      ? budget.source === "xlsx"
                        ? `Importado · ${budget.fileName ?? "Excel"}${budget.sourceSheet ? ` · aba ${budget.sourceSheet}` : ""}`
                        : "Definido manualmente"
                      : "Defina o orçamento para liberar os indicadores"}
                  </p>
                </div>
              </GlowSection>
              <GlowSection accent={S.amber}>
                <div className="p-5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: S.amber, opacity: 0.65 }}>
                    Realizado
                  </p>
                  <p
                    className="text-2xl font-black tabular-nums leading-none"
                    style={{ color: S.amber, textShadow: `0 0 18px ${S.amber}99, 0 0 48px ${S.amber}44` }}
                  >
                    R$ {consumed.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: S.amber, opacity: 0.5 }}>
                    {entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}
                  </p>
                  {lastClosingExtraction ? (
                    <p className="text-[10px] mt-1" style={{ color: S.amber, opacity: 0.6 }}>
                      Fechamento: {lastClosingExtraction.fileName}
                    </p>
                  ) : null}
                </div>
              </GlowSection>
              <GlowSection accent={isOver ? S.red : S.green}>
                <div className="p-5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: isOver ? S.red : S.green, opacity: 0.65 }}>
                    Saldo Disponível
                  </p>
                  <p
                    className="text-2xl font-black tabular-nums leading-none"
                    style={{
                      color: isOver ? S.red : S.green,
                      textShadow: `0 0 18px ${isOver ? S.red : S.green}99, 0 0 48px ${isOver ? S.red : S.green}44`,
                    }}
                  >
                    {totalBudget > 0
                      ? `${isOver ? "− " : ""}R$ ${Math.abs(balance).toLocaleString("pt-BR")}`
                      : "—"}
                  </p>
                </div>
              </GlowSection>
            </div>

            <GlowSection accent={S.accent}>
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-0.5" style={{ color: S.accent, opacity: 0.55 }}>
                      Execução do Budget (realizado / previsto)
                    </p>
                    <p className="text-sm" style={{ color: S.muted }}>
                      R$ {consumed.toLocaleString("pt-BR")} de{" "}
                      {totalBudget > 0
                        ? `R$ ${totalBudget.toLocaleString("pt-BR")}`
                        : "— sem orçamento —"}
                    </p>
                  </div>
                  <span
                    className="text-sm font-black px-3 py-1 rounded-full tabular-nums"
                    style={{
                      background: pct > 85 ? S.redBg : S.amberBg,
                      color: pct > 85 ? S.red : S.amber,
                      border: `1px solid ${pct > 85 ? S.redBorder : S.amberBorder}`,
                      textShadow: `0 0 10px ${pct > 85 ? S.red : S.amber}88`,
                    }}
                  >
                    {totalBudget > 0 ? `${pct.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "#050e1f" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: pct > 85
                        ? `linear-gradient(90deg, #ff4466, #ff6680)`
                        : `linear-gradient(90deg, ${S.amber}, ${S.amberLight})`,
                      boxShadow: pct > 0 ? `0 0 8px ${pct > 85 ? S.red : S.amber}88` : "none",
                    }}
                  />
                </div>
              </div>
            </GlowSection>

            {budget && Object.keys(budget.breakdown).length > 0 ? (
              <BreakdownPanel breakdown={budget.breakdown} totalBudget={totalBudget} />
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2" id="custos-novo-lancamento">
              <GlowSection accent={S.amber} className="h-full">
                <div className="p-6" style={{ opacity: activeProject ? 1 : 0.6 }}>
                <div
                  className="flex items-center gap-2 mb-3 pb-4"
                  style={{ borderBottom: `1px solid rgba(255,183,0,0.1)` }}
                >
                  <span className="block w-[2px] h-4 rounded-full" style={{ background: S.amber, boxShadow: `0 0 8px ${S.amber}` }} />
                  <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: S.amber, textShadow: `0 0 12px ${S.amber}55` }}>
                    Novo lançamento
                  </h2>
                </div>
                <p className="text-[11px] leading-relaxed mb-4" style={{ color: S.muted }}>
                  No <strong style={{ color: S.text }}>cabeçalho</strong> estão{" "}
                  <strong style={{ color: S.text }}>Importar orçamento</strong> (previsto) e{" "}
                  <strong style={{ color: S.text }}>Importar fechamento</strong> (PDF). Abaixo, registe{" "}
                  <strong style={{ color: S.amber }}>custos manuais</strong> pontuais — por exemplo
                  demandas aprovadas por fora do orçamento e que precisaram ser executadas.
                </p>
                {!activeProject ? (
                  <p className="text-xs mb-4" style={{ color: S.muted }}>
                    Selecione um projeto aberto ou crie com <strong>+ Novo projeto</strong> / <strong>Importar orçamento</strong>.
                  </p>
                ) : null}
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: S.amber, opacity: 0.85 }}>
                  Custo manual
                </p>
                <div className="space-y-4">
                  {(["Categoria", "Valor (R$)", "Descrição", "Justificativa"] as const).map((lbl) => (
                    <div key={lbl}>
                      <label
                        className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                        style={{ color: S.muted }}
                      >
                        {lbl}
                      </label>
                      {lbl === "Categoria" ? (
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          disabled={!activeProject}
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed"
                          style={{
                            background: S.inputBg,
                            border: `1px solid ${S.border}`,
                            color: S.text,
                          }}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={
                            lbl === "Valor (R$)"
                              ? amount
                              : lbl === "Descrição"
                                ? description
                                : justification
                          }
                          onChange={(e) =>
                            lbl === "Valor (R$)"
                              ? setAmount(e.target.value)
                              : lbl === "Descrição"
                                ? setDescription(e.target.value)
                                : setJustification(e.target.value)
                          }
                          type="text"
                          inputMode={lbl === "Valor (R$)" ? "decimal" : undefined}
                          disabled={!activeProject}
                          placeholder={
                            lbl === "Valor (R$)"
                              ? "Ex.: 1500 ou 1.234,56"
                              : lbl === "Descrição"
                                ? "Ex.: Freelancer de montagem extra"
                                : "Ex.: Aprovado por Nome — motivo (ou use a opção abaixo)"
                          }
                          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed"
                          style={{
                            background: S.inputBg,
                            border: `1px solid ${S.border}`,
                            color: S.text,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <label
                  className={`mt-4 flex items-start gap-3 rounded-lg px-3 py-3 border ${activeProject ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                  style={{
                    background: entryOutsideBudget ? "rgba(255,183,0,0.08)" : "rgba(3,10,22,0.6)",
                    borderColor: entryOutsideBudget ? "rgba(255,183,0,0.35)" : S.border,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={entryOutsideBudget}
                    onChange={(e) => setEntryOutsideBudget(e.target.checked)}
                    disabled={!activeProject}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-600 accent-amber-500"
                  />
                  <span className="text-xs leading-snug" style={{ color: S.text }}>
                    <span className="font-bold" style={{ color: S.amber }}>
                      Aprovado fora do orçamento
                    </span>
                    <span style={{ color: S.muted }}>
                      {" "}
                      — marca o lançamento e, se a justificativa estiver vazia, preenche o texto padrão de
                      aprovação operacional.
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={!activeProject}
                  className="mt-5 w-full rounded-lg py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
                  style={{
                    background: S.amberBg,
                    color: S.amber,
                    border: `1px solid ${S.amberBorder}`,
                    boxShadow: activeProject ? `0 0 14px rgba(255,183,0,0.15)` : "none",
                    opacity: activeProject ? 1 : 0.5,
                  }}
                >
                  {editingEntryId ? "Salvar alteração" : "Adicionar custo manual"}
                </button>
                </div>
              </GlowSection>
              </div>

              <GlowSection accent={S.accent} className="lg:col-span-3 overflow-hidden">
                <div
                  className="flex items-center justify-between px-6 py-4"
                  style={{ borderBottom: `1px solid rgba(6,214,245,0.1)` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="block w-[2px] h-4 rounded-full" style={{ background: S.accent, boxShadow: `0 0 8px ${S.accent}` }} />
                    <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: S.accent, textShadow: `0 0 12px ${S.accent}55` }}>
                      Lançamentos
                    </h2>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: S.amberBg,
                      color: S.amber,
                      border: `1px solid ${S.amberBorder}`,
                    }}
                  >
                    {entries.length} {entries.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                {!activeProject ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <p className="text-sm" style={{ color: S.muted }}>
                      Nenhum projeto ativo. Escolha um no campo <strong>Projeto</strong> no topo, ou
                      crie com <strong>+ Novo projeto</strong> / <strong>Importar orçamento</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className="px-6 py-4 space-y-3"
                      style={{
                        borderBottom: `1px solid rgba(6,214,245,0.1)`,
                        background: "rgba(3,10,22,0.45)",
                      }}
                    >
                      <p
                        className="text-[9px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: S.accent, opacity: 0.75 }}
                      >
                        Previsto vs realizado
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div
                          className="rounded-lg px-3 py-2.5"
                          style={{
                            background: "rgba(6,214,245,0.08)",
                            border: `1px solid ${S.accentBorder}`,
                          }}
                        >
                          <p
                            className="text-[9px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: S.accent, opacity: 0.6 }}
                          >
                            Previsto (orçamento)
                          </p>
                          <p
                            className="text-lg font-black tabular-nums leading-tight"
                            style={{ color: S.accent, textShadow: `0 0 12px ${S.accent}44` }}
                          >
                            {totalBudget > 0 ? `R$ ${totalBudget.toLocaleString("pt-BR")}` : "—"}
                          </p>
                        </div>
                        <div
                          className="rounded-lg px-3 py-2.5"
                          style={{ background: S.amberBg, border: `1px solid ${S.amberBorder}` }}
                        >
                          <p
                            className="text-[9px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: S.amber, opacity: 0.65 }}
                          >
                            Realizado (lançamentos)
                          </p>
                          <p
                            className="text-lg font-black tabular-nums leading-tight"
                            style={{ color: S.amber, textShadow: `0 0 12px ${S.amber}44` }}
                          >
                            R$ {consumed.toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div
                          className="rounded-lg px-3 py-2.5"
                          style={{
                            background: isOver ? S.redBg : S.greenBg,
                            border: `1px solid ${isOver ? S.redBorder : S.greenBorder}`,
                          }}
                        >
                          <p
                            className="text-[9px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: isOver ? S.red : S.green, opacity: 0.7 }}
                          >
                            Saldo (prev. − real.)
                          </p>
                          <p
                            className="text-lg font-black tabular-nums leading-tight"
                            style={{ color: isOver ? S.red : S.green }}
                          >
                            {totalBudget > 0
                              ? `${isOver ? "− " : ""}R$ ${Math.abs(balance).toLocaleString("pt-BR")}`
                              : "—"}
                          </p>
                        </div>
                      </div>
                      {totalBudget > 0 &&
                        !Object.values(budget?.breakdown ?? {}).some(
                          (n) => typeof n === "number" && n > 0
                        ) && (
                        <p className="text-[10px] leading-relaxed" style={{ color: S.dim }}>
                          A quebra do orçamento por categoria ainda não foi preenchida; a tabela abaixo
                          resume só o total. Defina a quebra no orçamento para ver previsto realizado em cada
                          rubrica.
                        </p>
                      )}
                      {(CATEGORIES.some((cat) => {
                        const prev = budget ? (budget.breakdown[labelToBudgetKey[cat]] ?? 0) : 0;
                        const real = realizedByCategory[cat] ?? 0;
                        return prev > 0 || real > 0;
                      }) ||
                        realizedOutsideCatalog > 0) && (
                        <div className="pt-2">
                          <p
                            className="text-[9px] font-bold uppercase tracking-widest mb-2"
                            style={{ color: S.dim }}
                          >
                            Por categoria
                          </p>
                          <div className="overflow-x-auto">
                            <div
                              className="min-w-[320px] grid grid-cols-[1fr_88px_88px_88px] gap-2 py-1.5 border-b"
                              style={{ borderColor: S.borderSub }}
                            >
                              {(["Categoria", "Prev.", "Real.", "Δ"] as const).map((h) => (
                                <span
                                  key={h}
                                  className="text-[10px] font-bold uppercase tracking-widest"
                                  style={{ color: S.dim }}
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                            {CATEGORIES.map((cat) => {
                              const prevB = budget?.breakdown ?? ({} as Budget["breakdown"]);
                              const prev = prevB[labelToBudgetKey[cat]] ?? 0;
                              const real = realizedByCategory[cat] ?? 0;
                              if (prev === 0 && real === 0) return null;
                              const delta = prev - real;
                              return (
                                <div
                                  key={cat}
                                  className="min-w-[320px] grid grid-cols-[1fr_88px_88px_88px] gap-2 items-center py-1.5 border-b last:border-0 text-xs"
                                  style={{ borderColor: S.borderSub }}
                                >
                                  <span className="truncate" style={{ color: S.text }}>
                                    {cat}
                                  </span>
                                  <span className="text-right tabular-nums" style={{ color: S.accent }}>
                                    R$ {prev.toLocaleString("pt-BR")}
                                  </span>
                                  <span
                                    className="text-right tabular-nums"
                                    style={{ color: S.amber }}
                                  >
                                    R$ {real.toLocaleString("pt-BR")}
                                  </span>
                                  <span
                                    className="text-right tabular-nums font-semibold"
                                    style={{ color: delta >= 0 ? S.green : S.red }}
                                  >
                                    {delta >= 0 ? "" : "− "}
                                    R$ {Math.abs(delta).toLocaleString("pt-BR")}
                                  </span>
                                </div>
                              );
                            })}
                            {realizedOutsideCatalog > 0 ? (
                              <div
                                className="min-w-[320px] grid grid-cols-[1fr_88px_88px_88px] gap-2 items-center py-1.5 text-xs"
                                style={{ color: S.muted }}
                              >
                                <span className="truncate italic" title="Categorias fora do mapa padrão do orçamento">
                                  Outras rubricas (soma)
                                </span>
                                <span className="text-right tabular-nums">—</span>
                                <span className="text-right tabular-nums" style={{ color: S.amber }}>
                                  R$ {realizedOutsideCatalog.toLocaleString("pt-BR")}
                                </span>
                                <span className="text-right tabular-nums">—</span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>

                    {entries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                        <p className="text-sm" style={{ color: S.muted }}>
                          Nenhum lançamento na lista. Use o formulário <strong>Novo lançamento</strong> à
                          esquerda ou importe o <strong>fechamento</strong> no cabeçalho.
                        </p>
                      </div>
                    ) : (
                  <>
                    <div
                      className="hidden sm:grid sm:grid-cols-[150px_1fr_1fr_120px_36px] gap-4 px-6 py-3"
                      style={{ background: "rgba(3,10,22,0.8)", borderBottom: `1px solid ${S.borderSub}` }}
                    >
                      {["Categoria", "Descrição", "Justificativa", "Valor", ""].map((h) => (
                        <span
                          key={h}
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: S.dim }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    {entries.map((entry, i) => {
                      const cs = CAT_STYLE[entry.category] ?? CAT_STYLE["Outros"];
                      return (
                        <div
                          key={entry.id}
                          className="grid grid-cols-1 sm:grid-cols-[150px_1fr_1fr_120px_36px] gap-3 sm:gap-4 items-center px-6 py-4"
                          style={{
                            borderBottom:
                              i < entries.length - 1 ? `1px solid ${S.borderSub}` : "none",
                          }}
                        >
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <span
                              className="text-[11px] font-semibold px-2 py-1 rounded-md inline-block w-fit"
                              style={{
                                background: cs.bg,
                                color: cs.color,
                                border: `1px solid ${cs.border}`,
                              }}
                            >
                              {entry.category}
                            </span>
                            {entry.outsideBudget ? (
                              <span
                                className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded w-fit"
                                style={{
                                  background: S.amberBg,
                                  color: S.amber,
                                  border: `1px solid ${S.amberBorder}`,
                                }}
                              >
                                Fora do previsto
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm truncate" style={{ color: S.text }}>
                            {entry.description}
                          </p>
                          <p className="text-sm truncate" style={{ color: S.muted }}>
                            {entry.justification}
                          </p>
                          <p
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: S.amber, textShadow: `0 0 8px ${S.amber}66` }}
                          >
                            R$ {entry.amount.toLocaleString("pt-BR")}
                          </p>
                          <button
                            type="button"
                            onClick={() => editEntry(entry)}
                            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                            style={{ color: S.accent }}
                            title="Editar lançamento"
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </>
                    )}
                  </>
                )}
              </GlowSection>
            </div>
          </>
        ) : null}

        {closedVisible.length > 0 ? (
          <>
            <BolsaoPanel sobras={bolsao.sobras} estouros={bolsao.estouros} liquido={bolsao.liquido} />
            <ClosedBudgetsTable projects={closedVisible} onReopen={handleReopenProject} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ProjectSelector({
  projects,
  activeProjectId,
  onChange,
  onCreate,
}: {
  projects: Project[];
  activeProjectId: string | null;
  onChange: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onCreate}
        className="text-xs font-bold px-3 py-1.5 rounded-lg"
        style={{
          background: S.greenBg,
          color: S.green,
          border: `1px solid ${S.greenBorder}`,
        }}
      >
        + Novo projeto
      </button>
      <label
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: S.muted }}
      >
        Projeto
      </label>
      <select
        value={activeProjectId ?? ""}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        disabled={projects.length === 0}
        className="rounded-lg px-3 py-1.5 text-xs outline-none"
        style={{
          background: S.inputBg,
          border: `1px solid ${S.border}`,
          color: S.text,
          minWidth: 220,
          opacity: projects.length === 0 ? 0.6 : 1,
        }}
      >
        {projects.length === 0 ? (
          <option value="">Nenhum aberto</option>
        ) : (
          projects.map((p) => (
            <option key={p.id} value={p.id}>
              {projectLabel(p)}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

function BolsaoPanel({
  sobras,
  estouros,
  liquido,
}: {
  sobras: number;
  estouros: number;
  liquido: number;
}) {
  const negativo = liquido < 0;
  const accent = negativo ? S.red : S.green;
  return (
    <GlowSection accent={accent} className="p-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: accent, textShadow: `0 0 12px ${accent}55` }}>
              Bolsão consolidado (projetos encerrados)
            </h2>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>
              Acumula sobras e estouros dos orçamentos encerrados.
            </p>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              background: negativo ? S.redBg : S.greenBg,
              color: negativo ? S.red : S.green,
              border: `1px solid ${negativo ? S.redBorder : S.greenBorder}`,
            }}
          >
            {negativo ? "Saldo líquido negativo" : "Saldo líquido positivo"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard label="Sobras acumuladas" value={`R$ ${sobras.toLocaleString("pt-BR")}`} tone="positive" />
          <KpiCard label="Estouros acumulados" value={`R$ ${estouros.toLocaleString("pt-BR")}`} tone="danger" />
          <KpiCard label="Bolsão líquido" value={`${liquido < 0 ? "− " : ""}R$ ${Math.abs(liquido).toLocaleString("pt-BR")}`} tone={negativo ? "danger" : "positive"} />
        </div>
      </div>
    </GlowSection>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "danger" }) {
  const color = tone === "danger" ? S.red : S.green;
  return (
    <GlowSection accent={color} className="p-4">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-1.5" style={{ color, opacity: 0.65 }}>{label}</p>
        <p className="text-xl font-black tabular-nums" style={{ color, textShadow: `0 0 14px ${color}88` }}>{value}</p>
      </div>
    </GlowSection>
  );
}

function ClosedBudgetsTable({
  projects,
  onReopen,
}: {
  projects: Project[];
  onReopen: (id: string) => void;
}) {
  return (
    <GlowSection accent={S.accent} className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(6,214,245,0.1)` }}>
        <div className="flex items-center gap-2">
          <span className="block w-[2px] h-4 rounded-full" style={{ background: S.accent, boxShadow: `0 0 8px ${S.accent}` }} />
          <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: S.accent, textShadow: `0 0 12px ${S.accent}55` }}>
            Orçamentos encerrados
          </h2>
        </div>
        <span className="text-xs font-bold" style={{ color: S.muted }}>
          {projects.length} {projects.length === 1 ? "linha" : "linhas"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "rgba(3,10,22,0.8)", borderBottom: `1px solid ${S.borderSub}` }}>
              {["Projeto", "Contrato", "Previsto", "Realizado", "Saldo", "Encerrado em", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: S.dim }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const previsto = p.budget.total ?? 0;
              const realizado = projectRealized(p);
              const saldo = previsto - realizado;
              const isNeg = saldo < 0;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${S.borderSub}` }}>
                  <td className="px-4 py-3" style={{ color: S.text }}>{p.budget.eventName || "(sem nome)"}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: S.muted }}>{p.budget.contractId || "—"}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: S.accent }}>R$ {previsto.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: S.amber }}>R$ {realizado.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: isNeg ? S.red : S.green }}>
                    {isNeg ? "− " : ""}R$ {Math.abs(saldo).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3" style={{ color: S.muted }}>
                    {p.closedAt ? new Date(p.closedAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onReopen(p.id)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                      style={{ background: S.accentBg, color: S.accent, border: `1px solid ${S.accentBorder}` }}
                    >
                      Reabrir orçamento
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlowSection>
  );
}

function BreakdownPanel({
  breakdown,
  totalBudget,
}: {
  breakdown: BudgetBreakdown;
  totalBudget: number;
}) {
  const items = useMemo(
    () =>
      (Object.entries(breakdown) as [BudgetCategoryKey, number][]).filter(
        ([, v]) => typeof v === "number" && v > 0
      ),
    [breakdown]
  );
  if (items.length === 0) return null;
  return (
    <GlowSection accent={S.accent} className="p-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="block w-[2px] h-4 rounded-full" style={{ background: S.accent, boxShadow: `0 0 8px ${S.accent}` }} />
            <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: S.accent, textShadow: `0 0 12px ${S.accent}55` }}>
              Quebra do orçamento por categoria
            </h2>
          </div>
          <span className="text-[10px] font-bold" style={{ color: S.dim }}>previsto</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {items.map(([k, v]) => {
            const lbl = BUDGET_CATEGORY_LABELS[k];
            const cs = CAT_STYLE[lbl] ?? CAT_STYLE["Outros"];
            const pct = totalBudget > 0 ? (v / totalBudget) * 100 : 0;
            return (
              <div key={k} className="rounded-lg p-3" style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: cs.color, opacity: 0.7 }}>{lbl}</p>
                <p className="text-sm font-black tabular-nums" style={{ color: cs.color, textShadow: `0 0 10px ${cs.color}66` }}>
                  R$ {v.toLocaleString("pt-BR")}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: cs.color, opacity: 0.5 }}>
                  {totalBudget > 0 ? `${pct.toFixed(1)}%` : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </GlowSection>
  );
}

function BudgetEditor({
  mode,
  value,
  extractionFromParent,
  onSave,
  onCancel,
  onImported,
}: {
  mode: "create" | "edit";
  value: Budget;
  extractionFromParent: BudgetXlsxExtraction | null;
  onSave: (b: Budget) => void;
  onCancel: () => void;
  onImported: (ex: BudgetXlsxExtraction, optionId?: BudgetXlsxOption["id"]) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Budget>(value);
  const [warn, setWarn] = useState<string[]>([]);
  const [lastExtraction, setLastExtraction] = useState<BudgetXlsxExtraction | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (extractionFromParent) {
      setLastExtraction(extractionFromParent);
      setWarn(extractionFromParent.warnings);
    } else {
      setLastExtraction(null);
      setWarn([]);
    }
  }, [extractionFromParent]);

  function setField<K extends keyof Budget>(k: K, v: Budget[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  function setBreak(k: BudgetCategoryKey, v: number) {
    setDraft((d) => ({ ...d, breakdown: { ...d.breakdown, [k]: v } }));
  }

  function applyExtractionToDraft(ex: BudgetXlsxExtraction, optionId?: BudgetXlsxOption["id"]) {
    const opt = optionId ? ex.options.find((o) => o.id === optionId) ?? null : null;
    const total = opt ? opt.total : ex.total ?? 0;
    const breakdown = opt ? opt.breakdown : ex.breakdown;
    setDraft((d) => ({
      ...d,
      eventName: ex.eventName ?? d.eventName,
      contractId: ex.contractId ?? d.contractId,
      startDate: ex.startDate ?? d.startDate,
      endDate: ex.endDate ?? d.endDate,
      location: ex.location ?? d.location,
      total,
      breakdown: { ...breakdown },
      source: "xlsx",
      fileName: ex.fileName,
      sourceSheet: ex.sourceSheet ?? undefined,
    }));
  }

  function chooseOption(id: BudgetXlsxOption["id"]) {
    if (!lastExtraction) return;
    const next = { ...lastExtraction, selectedOptionId: id };
    setLastExtraction(next);
    applyExtractionToDraft(next, id);
    onImported(next, id);
  }

  return (
    <GlowSection accent={S.accent} className="p-6">
      <div>
      <div
        className="flex items-center justify-between mb-4 pb-4"
        style={{ borderBottom: `1px solid rgba(6,214,245,0.1)` }}
      >
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: S.accent, textShadow: `0 0 12px ${S.accent}55` }}>
            {mode === "create" ? "Novo projeto" : "Editar orçamento do projeto"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            Preencha manualmente os campos abaixo ou use o botão <strong>Importar orçamento</strong> no topo
            do módulo para enviar a planilha de orçamento. O <strong>Previsto</strong> dos KPIs vem
            deste valor. O <strong>Realizado</strong> pode ser alimentado por lançamentos manuais e também
            por <strong>Importar fechamento</strong> (totais de Equipe de campo e Demais despesas no PDF Zig).
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{
            background: S.surface,
            color: S.dim,
            border: `1px solid ${S.border}`,
          }}
        >
          Fechar
        </button>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: S.accentBg, border: `1px solid ${S.accentBorder}` }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: S.accent, opacity: 0.7 }}>
          Leitura da importação
        </p>
        <p className="text-xs mt-1" style={{ color: S.muted }}>
          A importação é feita por <strong>Importar orçamento</strong> no cabeçalho (aceita .xlsx, .xlsm, .xls). Se o
          contrato já existir, só o orçamento previsto é atualizado; os lançamentos permanecem.
        </p>
        {lastExtraction ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs" style={{ color: S.green }}>
              <strong>{lastExtraction.fileName}</strong>
              {lastExtraction.total !== null
                ? ` · total detectado: R$ ${lastExtraction.total.toLocaleString("pt-BR")}`
                : " · total não detectado"}
              {lastExtraction.sourceSheet ? ` · aba ${lastExtraction.sourceSheet}` : ""}
            </p>
            {lastExtraction.sheetNames.length > 0 ? (
              <p className="text-[11px]" style={{ color: S.muted }}>
                Abas lidas: {lastExtraction.sheetNames.join(", ")}
              </p>
            ) : null}
            {lastExtraction.options.length > 1 ? (
              <div className="rounded-md p-3" style={{ background: "rgba(3,10,22,0.6)", border: `1px solid ${S.border}` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: S.accent, opacity: 0.7 }}>
                  Qual coluna usar como Previsto?
                </p>
                <div className="flex flex-wrap gap-2">
                  {lastExtraction.options.map((o) => {
                    const active = o.id === lastExtraction.selectedOptionId;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => chooseOption(o.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                        style={{
                          background: active ? S.amberBg : S.accentBg,
                          color: active ? S.amber : S.accent,
                          border: `1px solid ${active ? S.amberBorder : S.accentBorder}`,
                        }}
                      >
                        {active ? "✓ " : ""}{o.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] mt-2" style={{ color: S.muted }}>
                  Trocar aqui re-aplica o total e a quebra por categoria sem precisar reimportar.
                </p>
              </div>
            ) : null}
            {lastExtraction.debug.length > 0 ? (
              <details className="text-[11px]" style={{ color: S.muted }}>
                <summary className="cursor-pointer" style={{ color: S.accent }}>
                  Ver mapeamento detectado ({lastExtraction.debug.length})
                </summary>
                <ul className="mt-1 pl-4 list-disc">
                  {lastExtraction.debug.map((d, i) => (
                    <li key={i}>
                      <strong>{d.field}</strong> · {d.sheet}!{d.cell} ·{" "}
                      <em>&ldquo;{d.matchedText}&rdquo;</em> →{" "}
                      {typeof d.value === "number" ? `R$ ${d.value.toLocaleString("pt-BR")}` : (d.value ?? "—")}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
        {warn.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-xs" style={{ color: S.amber }}>
            {warn.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Field label="Nome do evento *" value={draft.eventName} onChange={(v) => setField("eventName", v)} />
        <Field label="Contrato" value={draft.contractId} onChange={(v) => setField("contractId", v)} />
        <Field label="Local" value={draft.location} onChange={(v) => setField("location", v)} />
        <Field label="Início (DD/MM/AAAA)" value={draft.startDate} onChange={(v) => setField("startDate", v)} />
        <Field label="Fim (DD/MM/AAAA)" value={draft.endDate} onChange={(v) => setField("endDate", v)} />
        <NumField label="Previsto / Budget total (R$) *" value={draft.total} onChange={(v) => setField("total", v)} />
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: S.muted }}>
          Quebra opcional por categoria (R$)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(BUDGET_CATEGORY_LABELS) as BudgetCategoryKey[]).map((k) => (
            <NumField key={k} compact label={BUDGET_CATEGORY_LABELS[k]} value={draft.breakdown[k] ?? 0} onChange={(v) => setBreak(k, v)} />
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setDraft(value)}
          className="rounded-lg px-4 py-2 text-sm font-medium"
          style={{ border: `1px solid ${S.border}`, color: S.dim, background: "transparent" }}
        >
          Reverter
        </button>
        <button
          type="button"
          onClick={() => {
            if (!draft.eventName.trim()) { alert("Informe o nome do evento."); return; }
            if (!Number.isFinite(draft.total) || draft.total < 0) { alert("Informe um Previsto / Budget total válido (>= 0)."); return; }
            onSave({ ...draft, total: Math.max(0, draft.total) });
          }}
          className="rounded-lg px-5 py-2 text-sm font-semibold"
          style={{ background: S.amberBg, color: S.amber, border: `1px solid ${S.amberBorder}`, boxShadow: `0 0 14px rgba(255,183,0,0.15)` }}
        >
          Salvar projeto
        </button>
      </div>
      </div>
    </GlowSection>
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
      <label
        className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: S.muted }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
        style={{ background: S.inputBg, border: `1px solid ${S.border}`, color: S.text }}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState<string>(String(value ?? 0));
  useEffect(() => {
    setText(String(value ?? 0));
  }, [value]);
  return (
    <div>
      <label
        className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: S.muted }}
      >
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(String(e.target.value).replace(",", "."));
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className={`w-full rounded-lg px-3 ${compact ? "py-2" : "py-2.5"} text-sm tabular-nums outline-none`}
        style={{ background: S.inputBg, border: `1px solid ${S.border}`, color: S.text }}
      />
    </div>
  );
}
