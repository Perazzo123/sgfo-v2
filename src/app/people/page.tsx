"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { makePersonId, type Person, type PersonStatus } from "@/lib/people/types";
import {
  getLastImportAt,
  isImportComplete,
  loadPeopleFromStorage,
  savePeopleToStorage,
} from "@/lib/people/storage";

const STATUS_OPTIONS: PersonStatus[] = ["Ativo", "Afastado", "Inativo"];

type FormState = {
  name: string;
  role: string;
  squad: string;
  region: string;
  managerName: string;
  currentSalary: string;
  zigTotalCost: string;
  marketBenchmark: string;
  proposedSalary: string;
  freelanceAverage2025: string;
  status: PersonStatus;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  role: "",
  squad: "",
  region: "",
  managerName: "",
  currentSalary: "",
  zigTotalCost: "",
  marketBenchmark: "",
  proposedSalary: "",
  freelanceAverage2025: "",
  status: "Ativo",
  notes: "",
};

const CARD = {
  background: "#1d2436",
  border: "1px solid #2a3550",
  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
} as const;

const INPUT = { background: "#12192a", border: "1px solid #2a3550", color: "#e2e8f5" } as const;

const STATUS_STYLE: Record<PersonStatus, { bg: string; color: string }> = {
  Ativo:    { bg: "#0d1f18", color: "#34d399" },
  Afastado: { bg: "#211c0e", color: "#fbbf24" },
  Inativo:  { bg: "#1d2436", color: "#4a5a7a" },
};

const SQUAD_COLORS  = ["#0d1829", "#0d1f18", "#170d29", "#211c0e", "#0d1a29", "#1f0d0d"];
const SQUAD_BORDERS = ["#1a2e4a", "#1a3a2a", "#2a1845", "#3a2e0f", "#1a3045", "#3a1a1a"];
const SQUAD_TEXT    = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#38bdf8", "#f87171"];

type SquadSummary = {
  squad: string;
  count: number;
  totalCost: number;
  avgSalary: number;
  totalGap: number;
};

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showImportOk, setShowImportOk] = useState(false);

  useEffect(() => {
    setPeople(loadPeopleFromStorage());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    savePeopleToStorage(people);
  }, [people, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("imported") === "1") {
      setShowImportOk(true);
      const u = new URL(window.location.href);
      u.searchParams.delete("imported");
      window.history.replaceState(null, "", u.toString());
    }
  }, []);

  const [importedOnce, setImportedOnce] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);
  useEffect(() => {
    setImportedOnce(isImportComplete());
    setLastAt(getLastImportAt());
  }, [people, ready]);

  const activePeople = useMemo(
    () => people.filter((p) => p.status === "Ativo"),
    [people]
  );
  const headcount = activePeople.length;
  const totalZigCost = useMemo(
    () => activePeople.reduce((s, p) => s + p.zigTotalCost, 0),
    [activePeople]
  );
  const totalGap = useMemo(
    () =>
      activePeople.reduce(
        (s, p) => s + Math.max(0, p.marketBenchmark - p.currentSalary),
        0
      ),
    [activePeople]
  );
  const totalRaiseImpact = useMemo(
    () =>
      activePeople.reduce(
        (s, p) => s + Math.max(0, p.proposedSalary - p.currentSalary),
        0
      ),
    [activePeople]
  );
  const squadCount = useMemo(
    () =>
      new Set(
        activePeople
          .map((p) => p.squad || "Sem squad")
      ).size,
    [activePeople]
  );

  const squadSummaries: SquadSummary[] = useMemo(() => {
    const map = new Map<string, SquadSummary>();
    for (const p of activePeople) {
      const key = p.squad || "Sem squad";
      const cur = map.get(key) ?? {
        squad: key,
        count: 0,
        totalCost: 0,
        avgSalary: 0,
        totalGap: 0,
      };
      cur.count += 1;
      cur.totalCost += p.zigTotalCost;
      cur.avgSalary += p.currentSalary;
      cur.totalGap += Math.max(0, p.marketBenchmark - p.currentSalary);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        avgSalary: s.count ? s.avgSalary / s.count : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [activePeople]);

  function addPerson() {
    const name = form.name.trim();
    const role = form.role.trim();
    const squad = form.squad.trim();
    const currentSalary = Number(form.currentSalary);
    if (!name || !role || !squad || !currentSalary) {
      setError("Nome, cargo, squad e salário atual são obrigatórios.");
      return;
    }
    const f = Number(form.freelanceAverage2025);
    setPeople((list) => [
      ...list,
      {
        id: makePersonId(),
        name,
        role,
        squad,
        region: form.region.trim(),
        managerName: form.managerName.trim(),
        currentSalary,
        zigTotalCost: Number(form.zigTotalCost) || currentSalary,
        marketBenchmark: Number(form.marketBenchmark) || currentSalary,
        proposedSalary: Number(form.proposedSalary) || currentSalary,
        freelanceAverage2025:
          form.freelanceAverage2025 && Number.isFinite(f) ? Math.max(0, f) : 0,
        status: form.status,
        notes: form.notes.trim(),
        behaviorScore: null,
        deliveryScore: null,
        classification: "—",
        merit: null,
        promotion: "—",
        talent: "—",
      },
    ]);
    setForm(emptyForm);
    setError(null);
  }

  function removePerson(id: string) {
    setPeople((list) => list.filter((p) => p.id !== id));
  }

  return (
    <div className="min-h-full" style={{ background: "#151a27" }}>
      <div
        className="px-8 py-5 flex flex-wrap items-start justify-between gap-4"
        style={{ background: "#111827", borderBottom: "1px solid #1a2235" }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "#f59e0b" }}
          >
            SGFO · Módulo
          </p>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Gestão de Pessoas
          </h1>
          {importedOnce && lastAt ? (
            <p className="text-xs mt-1" style={{ color: "#60a5fa" }}>
              Base organizacional carregada · import concluído em{" "}
              {new Date(lastAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : !importedOnce ? (
            <p className="text-xs mt-1" style={{ color: "#60a5fa" }}>
              Nenhum arquivo mestre ainda. Importe a planilha (uma única vez).
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!importedOnce ? (
            <Link
              href="/people/import"
              className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: "#211c0e", color: "#fbbf24", border: "1px solid #3a2e0f" }}
            >
              Importar base (Excel)
            </Link>
          ) : null}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {showImportOk ? (
          <div
            className="rounded-xl px-4 py-3 flex items-start justify-between gap-2"
            style={{ background: "#0d1f18", border: "1px solid #1a3a2a" }}
          >
            <p className="text-sm" style={{ color: "#34d399" }}>
              <strong>Base importada com sucesso.</strong> A lista abaixo reflete os
              dados da planilha, persistidos neste navegador. Você não precisa
              reenviar o Excel.
            </p>
            <button
              type="button"
              onClick={() => setShowImportOk(false)}
              className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded"
              style={{ color: "#34d399" }}
            >
              Fechar
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi
            label="Headcount ativo"
            v={String(headcount)}
            tone="bl"
          />
          <Kpi label="Custo total (Zig)" v={formatBRL(totalZigCost)} tone="v" />
          <Kpi
            label="Defasagem salarial"
            v={formatBRL(totalGap)}
            danger={totalGap > 0}
            tone="d"
          />
          <Kpi
            label="Impacto dos aumentos"
            v={formatBRL(totalRaiseImpact)}
            tone="a"
          />
        </div>

        {squadCount > 0 && (
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#5b7aaa" }}>
            Squads no radar: {squadCount} distintos
          </p>
        )}

        <section className="rounded-xl p-6" style={CARD}>
          <div
            className="flex items-center gap-2 mb-5 pb-4"
            style={{ borderBottom: "1px solid #1e2a42" }}
          >
            <div
              className="w-1 h-4 rounded-full"
              style={{ background: "#f59e0b" }}
            />
            <h2 className="text-sm font-bold" style={{ color: "#e2e8f5" }}>
              Adicionar pessoa
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              label="Nome *"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Ex.: Maria Silva"
            />
            <FormField
              label="Cargo *"
              value={form.role}
              onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            />
            <FormField
              label="Squad *"
              value={form.squad}
              onChange={(v) => setForm((f) => ({ ...f, squad: v }))}
            />
            <FormField
              label="Região"
              value={form.region}
              onChange={(v) => setForm((f) => ({ ...f, region: v }))}
            />
            <FormField
              label="Gestor"
              value={form.managerName}
              onChange={(v) => setForm((f) => ({ ...f, managerName: v }))}
            />
            <div>
              <label
                className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                style={{ color: "#5b7aaa" }}
              >
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as PersonStatus,
                  }))
                }
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={INPUT}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <NumField
              label="Salário atual *"
              value={form.currentSalary}
              onChange={(v) => setForm((f) => ({ ...f, currentSalary: v }))}
            />
            <NumField
              label="Custo total (Zig)"
              value={form.zigTotalCost}
              onChange={(v) => setForm((f) => ({ ...f, zigTotalCost: v }))}
            />
            <NumField
              label="Benchmark de mercado"
              value={form.marketBenchmark}
              onChange={(v) => setForm((f) => ({ ...f, marketBenchmark: v }))}
            />
            <NumField
              label="Salário proposto"
              value={form.proposedSalary}
              onChange={(v) => setForm((f) => ({ ...f, proposedSalary: v }))}
            />
            <NumField
              label="Méd. Freel. 2025"
              value={form.freelanceAverage2025}
              onChange={(v) =>
                setForm((f) => ({ ...f, freelanceAverage2025: v }))
              }
            />
            <div className="md:col-span-2 xl:col-span-3">
              <label
                className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
                style={{ color: "#5b7aaa" }}
              >
                Observações
              </label>
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={2}
                className="w-full resize-y rounded-lg px-3 py-2.5 text-sm outline-none"
                style={INPUT}
              />
            </div>
          </div>
          {error && (
            <p
              className="mt-4 rounded-lg px-3 py-2 text-xs"
              style={{
                background: "#1f0d0d",
                color: "#f87171",
                border: "1px solid #3a1a1a",
              }}
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setForm(emptyForm);
                setError(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ border: "1px solid #2a3550", color: "#4a5a7a", background: "#1d2436" }}
            >
              Limpar
            </button>
            <button
              onClick={addPerson}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
              style={{ background: "#211c0e", color: "#fbbf24", border: "1px solid #3a2e0f" }}
            >
              Adicionar pessoa
            </button>
          </div>
        </section>

        {squadSummaries.length > 0 && (
          <section>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#5b7aaa" }}
            >
              Resumo por squad
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {squadSummaries.map((s, idx) => {
                const bg = SQUAD_COLORS[idx % SQUAD_COLORS.length];
                const br = SQUAD_BORDERS[idx % SQUAD_BORDERS.length];
                const tc = SQUAD_TEXT[idx % SQUAD_TEXT.length];
                return (
                  <div
                    key={s.squad}
                    className="rounded-xl p-5"
                    style={{ background: bg, border: `1px solid ${br}` }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold" style={{ color: tc }}>
                        {s.squad}
                      </p>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(0,0,0,0.25)", color: tc }}
                      >
                        {s.count} {s.count === 1 ? "pessoa" : "pessoas"}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3">
                      {(
                        [
                          { label: "Custo total", value: formatBRL(s.totalCost) },
                          {
                            label: "Média salarial",
                            value: formatBRL(s.avgSalary),
                          },
                          { label: "Defasagem", value: formatBRL(s.totalGap) },
                          {
                            label: "% do custo",
                            value:
                              totalZigCost > 0
                                ? `${((s.totalCost / totalZigCost) * 100).toFixed(1)}%`
                                : "—",
                          },
                        ] as const
                      ).map((stat) => (
                        <div key={stat.label}>
                          <dt
                            className="text-[10px] uppercase tracking-widest mb-0.5"
                            style={{ color: tc, opacity: 0.6 }}
                          >
                            {stat.label}
                          </dt>
                          <dd
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: tc }}
                          >
                            {stat.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-xl overflow-hidden" style={CARD}>
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{
              background: "#222c40",
              borderBottom: "1px solid #2a3550",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-1 h-4 rounded-full"
                style={{ background: "#f59e0b" }}
              />
              <h2
                className="text-sm font-bold"
                style={{ color: "#e2e8f5" }}
              >
                Pessoas cadastradas
              </h2>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#211c0e", color: "#fbbf24", border: "1px solid #3a2e0f" }}
            >
              {people.length}{" "}
              {people.length === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>

          {people.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-sm" style={{ color: "#4a5a7a" }}>
                Nenhuma pessoa na base ainda. Use a importação Excel (uma única
                vez) ou inclua acima.
              </p>
              {!importedOnce && (
                <Link
                  href="/people/import"
                  className="mt-3 text-sm font-semibold"
                  style={{ color: "#f59e0b" }}
                >
                  Abrir tela de importação →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-sm border-separate border-spacing-0">
                <thead>
                  <tr style={{ background: "#222c40" }}>
                    {(
                      [
                        "Pessoa",
                        "Squad",
                        "Gestor",
                        "Salário",
                        "Custo Zig",
                        "Benchmark",
                        "Defasagem",
                        "Proposto",
                        "M. Freel. 25",
                        "Classif.",
                        "N.C.",
                        "N.E.",
                        "Impacto",
                        "Status",
                        "",
                      ] as const
                    ).map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: "#4a6fa5", borderBottom: "1px solid #1e2a42" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p, i) => {
                    const gap = p.marketBenchmark - p.currentSalary;
                    const gapPct =
                      p.marketBenchmark > 0
                        ? (gap / p.marketBenchmark) * 100
                        : 0;
                    const raise = p.proposedSalary - p.currentSalary;
                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderBottom:
                            i < people.length - 1 ? "1px solid #1e2a42" : "none",
                        }}
                      >
                        <td className="px-3 py-2">
                          <div className="font-semibold" style={{ color: "#e2e8f5" }}>
                            {p.name}
                          </div>
                          <div className="text-xs" style={{ color: "#4a5a7a" }}>
                            {p.role}
                            {p.region ? ` · ${p.region}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                            style={{ background: "#0d1829", color: "#60a5fa", border: "1px solid #1a2e4a" }}
                          >
                            {p.squad}
                          </span>
                        </td>
                        <td
                          className="px-3 py-2 text-xs max-w-[120px] truncate"
                          style={{ color: "#7a90b8" }}
                        >
                          {p.managerName || "—"}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums text-right font-medium"
                          style={{ color: "#fbbf24" }}
                        >
                          {formatBRL(p.currentSalary)}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums text-right"
                          style={{ color: "#a78bfa" }}
                        >
                          {formatBRL(p.zigTotalCost)}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums text-right"
                          style={{ color: "#38bdf8" }}
                        >
                          {formatBRL(p.marketBenchmark)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div
                            className="tabular-nums font-semibold"
                            style={{
                              color: gap > 0 ? "#f87171" : "#34d399",
                            }}
                          >
                            {gap === 0
                              ? "—"
                              : `${gap > 0 ? "−" : "+"}${formatBRL(Math.abs(gap))}`}
                          </div>
                          {gapPct !== 0 && (
                            <div
                              className="text-[11px] tabular-nums"
                              style={{
                                color: gap > 0 ? "#f87171" : "#34d399",
                              }}
                            >
                              {gapPct > 0 ? "-" : "+"}
                              {Math.abs(gapPct).toFixed(1)}%
                            </div>
                          )}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums text-right"
                          style={{ color: "#a78bfa" }}
                        >
                          {formatBRL(p.proposedSalary)}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums text-right"
                          style={{ color: "#38bdf8" }}
                        >
                          {formatBRL(p.freelanceAverage2025)}
                        </td>
                        <td
                          className="px-3 py-2 text-xs max-w-[88px] truncate"
                          style={{ color: "#7a90b8" }}
                          title={p.classification}
                        >
                          {p.classification}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums text-right text-xs"
                          style={{ color: "#7a90b8" }}
                        >
                          {p.behaviorScore ?? "—"}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums text-right text-xs"
                          style={{ color: "#7a90b8" }}
                        >
                          {p.deliveryScore ?? "—"}
                        </td>
                        <td
                          className="px-3 py-2 tabular-nums font-semibold text-right"
                          style={{ color: raise > 0 ? "#fbbf24" : "#3d5575" }}
                        >
                          {raise > 0 ? `+${formatBRL(raise)}` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                            style={{
                              background: STATUS_STYLE[p.status].bg,
                              color: STATUS_STYLE[p.status].color,
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removePerson(p.id)}
                            className="text-xs font-medium px-2.5 py-1 rounded-md"
                            style={{ border: "1px solid #2a3550", color: "#5b7aaa", background: "#1d2436" }}
                            type="button"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  v,
  danger,
  tone,
}: {
  label: string;
  v: string;
  danger?: boolean;
  tone: "bl" | "v" | "d" | "a";
}) {
  const t = {
    bl: { bg: "#0d1829", br: "#1a2e4a", tc: "#60a5fa" },
    v:  { bg: "#170d29", br: "#2a1845", tc: "#a78bfa" },
    d: {
      bg: danger ? "#1f0d0d" : "#0d1f18",
      br: danger ? "#3a1a1a" : "#1a3a2a",
      tc: danger ? "#f87171" : "#34d399",
    },
    a:  { bg: "#211c0e", br: "#3a2e0f", tc: "#fbbf24" },
  }[tone];
  return (
    <div className="rounded-xl p-5" style={{ background: t.bg, border: `1px solid ${t.br}` }}>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: t.tc }}
      >
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: t.tc }}>
        {v}
      </p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: "#5b7aaa" }}
      >
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
        style={INPUT}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: "#5b7aaa" }}
      >
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2.5 text-sm tabular-nums outline-none"
        style={INPUT}
      />
    </div>
  );
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
