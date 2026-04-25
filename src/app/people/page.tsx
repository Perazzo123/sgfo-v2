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
  freelanceAverage2025: "",
  status: "Ativo",
  notes: "",
};

const P = {
  accent: "#00ff88",
  accentBg: "rgba(0,255,136,0.05)",
  accentBorder: "rgba(0,255,136,0.15)",
  amber: "#ffb700",
  amberBg: "rgba(255,183,0,0.06)",
  amberBorder: "rgba(255,183,0,0.2)",
  violet: "#a855f7",
  violetBg: "rgba(168,85,247,0.05)",
  violetBorder: "rgba(168,85,247,0.15)",
  cyan: "#06d6f5",
  text: "#c8e8ff",
  muted: "#4a7a9a",
  dim: "#2a5070",
  inputBg: "#050e1f",
  inputBorder: "#0d2040",
  border: "#0d2040",
  borderSub: "#081630",
};

const INPUT = { background: P.inputBg, border: `1px solid ${P.inputBorder}`, color: P.text } as const;

const STATUS_STYLE: Record<PersonStatus, { bg: string; color: string; border: string }> = {
  Ativo:    { bg: "rgba(0,255,136,0.06)",  color: "#00ff88", border: "rgba(0,255,136,0.2)"  },
  Afastado: { bg: "rgba(255,183,0,0.06)",  color: "#ffb700", border: "rgba(255,183,0,0.2)"  },
  Inativo:  { bg: "rgba(42,80,112,0.3)",   color: "#4a7a9a", border: "rgba(42,80,112,0.3)"  },
};

const SQUAD_COLORS  = [
  "rgba(6,214,245,0.05)", "rgba(0,255,136,0.05)", "rgba(168,85,247,0.05)",
  "rgba(255,183,0,0.05)", "rgba(6,214,245,0.04)", "rgba(255,68,102,0.05)",
];
const SQUAD_BORDERS = [
  "rgba(6,214,245,0.15)", "rgba(0,255,136,0.15)", "rgba(168,85,247,0.15)",
  "rgba(255,183,0,0.15)", "rgba(6,214,245,0.12)", "rgba(255,68,102,0.15)",
];
const SQUAD_TEXT = ["#06d6f5", "#00ff88", "#a855f7", "#ffb700", "#38c8f5", "#ff4466"];

type SquadSummary = { squad: string; count: number; totalCost: number; avgZigCost: number };

function GlowSection({
  accent = "#00ff88",
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

  const activePeople = useMemo(() => people.filter((p) => p.status === "Ativo"), [people]);
  const headcount = activePeople.length;
  const totalZigCost = useMemo(() => activePeople.reduce((s, p) => s + p.zigTotalCost, 0), [activePeople]);
  const squadCount = useMemo(() => new Set(activePeople.map((p) => p.squad || "Sem squad")).size, [activePeople]);

  const multiploEncargos = useMemo(() => {
    const totalSalario = activePeople.reduce((s, p) => s + p.currentSalary, 0);
    return totalSalario > 0 ? totalZigCost / totalSalario : 0;
  }, [activePeople, totalZigCost]);

  const disponibilidade = people.length > 0 ? (activePeople.length / people.length) * 100 : 0;

  const spanOfControl = useMemo(() => {
    const managers = new Set(activePeople.filter((p) => p.managerName).map((p) => p.managerName));
    return managers.size > 0 ? headcount / managers.size : 0;
  }, [activePeople, headcount]);

  const avgTicket = headcount > 0 ? totalZigCost / headcount : 0;

  const squadSummaries: SquadSummary[] = useMemo(() => {
    const map = new Map<string, SquadSummary>();
    for (const p of activePeople) {
      const key = p.squad || "Sem squad";
      const cur = map.get(key) ?? { squad: key, count: 0, totalCost: 0, avgZigCost: 0 };
      cur.count += 1;
      cur.totalCost += p.zigTotalCost;
      cur.avgZigCost += p.zigTotalCost;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((s) => ({ ...s, avgZigCost: s.count ? s.avgZigCost / s.count : 0 }))
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
        name, role, squad,
        region: form.region.trim(),
        managerName: form.managerName.trim(),
        currentSalary,
        zigTotalCost: Number(form.zigTotalCost) || currentSalary,
        marketBenchmark: currentSalary,
        proposedSalary: currentSalary,
        freelanceAverage2025: form.freelanceAverage2025 && Number.isFinite(f) ? Math.max(0, f) : 0,
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

  function updatePerson(id: string, patch: Partial<Person>) {
    setPeople((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="min-h-full" style={{ background: "radial-gradient(ellipse at 40% 0%, #071428 0%, #030b18 55%, #020810 100%)" }}>
      {/* Header */}
      <div
        className="px-8 py-5 flex flex-wrap items-start justify-between gap-4"
        style={{ background: "rgba(3,10,22,0.95)", borderBottom: "1px solid rgba(0,255,136,0.1)", backdropFilter: "blur(8px)" }}
      >
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: "#ffb700", opacity: 0.75 }}>
            SGFO · Módulo
          </p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: "#c8e8ff", textShadow: "0 0 30px rgba(0,255,136,0.25)" }}>
            Gestão de Pessoas
          </h1>
          {importedOnce && lastAt ? (
            <p className="text-xs mt-1" style={{ color: P.accent, opacity: 0.6 }}>
              Base organizacional carregada · import concluído em{" "}
              {new Date(lastAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : !importedOnce ? (
            <p className="text-xs mt-1" style={{ color: P.accent, opacity: 0.5 }}>
              Nenhum arquivo mestre ainda. Importe a planilha (aba <code className="text-[10px]">BD</code>).
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/people/import"
            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ background: P.amberBg, color: P.amber, border: `1px solid ${P.amberBorder}`, boxShadow: "0 0 12px rgba(255,183,0,0.12)" }}
          >
            {importedOnce ? "Reimportar planilha" : "Importar base (Excel)"}
          </Link>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {showImportOk ? (
          <GlowSection accent={P.accent} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm" style={{ color: P.accent }}>
                <strong>Base atualizada com sucesso.</strong> A lista abaixo reflete os dados da aba{" "}
                <code className="text-xs">BD</code>, guardados neste navegador.
              </p>
              <button type="button" onClick={() => setShowImportOk(false)} className="shrink-0 text-xs font-bold px-2 py-0.5 rounded" style={{ color: P.accent }}>
                Fechar
              </button>
            </div>
          </GlowSection>
        ) : null}

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <Kpi label="Headcount ativo"    v={String(headcount)}                                                       accent={P.accent}  />
          <Kpi label="Custo total (Zig)"  v={formatBRL(totalZigCost)}                                                 accent={P.violet}  />
          <Kpi label="Ticket médio"       v={avgTicket > 0 ? formatBRL(avgTicket) : "—"}                              accent={P.amber}   />
          <Kpi label="Pessoas por gestor" v={spanOfControl > 0 ? `${spanOfControl.toFixed(1)}` : "—"} sub="média"     accent={P.cyan}    />
          <Kpi label="Múltiplo CLT"       v={multiploEncargos > 0 ? `${multiploEncargos.toFixed(2)}×` : "—"} sub="custo / salário" accent={P.violet} />
          <Kpi label="Disponibilidade"    v={people.length > 0 ? `${disponibilidade.toFixed(0)}%` : "—"} sub="ativos / total" accent={P.accent} />
        </div>

        {squadCount > 0 && (
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: P.dim }}>
            Squads no radar: <span style={{ color: P.accent }}>{squadCount}</span> distintos
          </p>
        )}

        {/* Add person form */}
        <GlowSection accent={P.amber} className="p-6">
          <div>
            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: `1px solid rgba(255,183,0,0.1)` }}>
              <span className="block w-[2px] h-4 rounded-full" style={{ background: P.amber, boxShadow: `0 0 8px ${P.amber}` }} />
              <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: P.amber, textShadow: `0 0 12px ${P.amber}55` }}>
                Adicionar pessoa
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormField label="Nome *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ex.: Maria Silva" />
              <FormField label="Cargo *" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
              <FormField label="Squad *" value={form.squad} onChange={(v) => setForm((f) => ({ ...f, squad: v }))} />
              <FormField label="Região" value={form.region} onChange={(v) => setForm((f) => ({ ...f, region: v }))} />
              <FormField label="Gestor" value={form.managerName} onChange={(v) => setForm((f) => ({ ...f, managerName: v }))} />
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: P.muted }}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PersonStatus }))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={INPUT}
                >
                  {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <NumField label="Salário atual *" value={form.currentSalary} onChange={(v) => setForm((f) => ({ ...f, currentSalary: v }))} />
              <NumField label="Custo total (Zig)" value={form.zigTotalCost} onChange={(v) => setForm((f) => ({ ...f, zigTotalCost: v }))} />
              <NumField label="Méd. Freel. 2025" value={form.freelanceAverage2025} onChange={(v) => setForm((f) => ({ ...f, freelanceAverage2025: v }))} />
              <div className="md:col-span-2 xl:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: P.muted }}>Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full resize-y rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={INPUT}
                />
              </div>
            </div>
            {error && (
              <p className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,68,102,0.06)", color: "#ff4466", border: "1px solid rgba(255,68,102,0.2)" }}>
                {error}
              </p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => { setForm(emptyForm); setError(null); }}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ border: `1px solid ${P.border}`, color: P.dim, background: "transparent" }}
              >
                Limpar
              </button>
              <button
                onClick={addPerson}
                className="rounded-lg px-5 py-2 text-sm font-semibold"
                style={{ background: P.amberBg, color: P.amber, border: `1px solid ${P.amberBorder}`, boxShadow: "0 0 14px rgba(255,183,0,0.15)" }}
              >
                Adicionar pessoa
              </button>
            </div>
          </div>
        </GlowSection>

        {/* Squad summaries */}
        {squadSummaries.length > 0 && (
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: P.dim }}>
              Resumo por squad
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {squadSummaries.map((s, idx) => {
                const bg = SQUAD_COLORS[idx % SQUAD_COLORS.length];
                const br = SQUAD_BORDERS[idx % SQUAD_BORDERS.length];
                const tc = SQUAD_TEXT[idx % SQUAD_TEXT.length];
                return (
                  <div key={s.squad} className="relative rounded-xl p-5" style={{ background: "rgba(4,12,26,0.97)", border: `1px solid ${br}`, boxShadow: `0 0 20px ${tc}0a` }}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-black" style={{ color: tc, textShadow: `0 0 10px ${tc}66` }}>{s.squad}</p>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: bg, color: tc, border: `1px solid ${br}` }}>
                        {s.count} {s.count === 1 ? "pessoa" : "pessoas"}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3">
                      {([
                        { label: "Custo Zig (total)", value: formatBRL(s.totalCost) },
                        { label: "Custo Zig (média)", value: formatBRL(s.avgZigCost) },
                        { label: "% do custo Zig",   value: totalZigCost > 0 ? `${((s.totalCost / totalZigCost) * 100).toFixed(1)}%` : "—" },
                      ] as const).map((stat) => (
                        <div key={stat.label}>
                          <dt className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: tc, opacity: 0.5 }}>{stat.label}</dt>
                          <dd className="text-sm font-black tabular-nums" style={{ color: tc, textShadow: `0 0 8px ${tc}55` }}>{stat.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* People table */}
        <GlowSection accent={P.accent} className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(0,255,136,0.1)` }}>
            <div className="flex items-center gap-2">
              <span className="block w-[2px] h-4 rounded-full" style={{ background: P.accent, boxShadow: `0 0 8px ${P.accent}` }} />
              <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: P.accent, textShadow: `0 0 12px ${P.accent}55` }}>
                Pessoas cadastradas
              </h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: P.amberBg, color: P.amber, border: `1px solid ${P.amberBorder}` }}>
              {people.length} {people.length === 1 ? "pessoa" : "pessoas"}
            </span>
          </div>

          {people.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-sm" style={{ color: P.muted }}>
                Nenhuma pessoa na base ainda. Importe a aba <code className="text-xs">BD</code>{" "}
                ou inclua alguém no formulário acima.
              </p>
              <Link href="/people/import" className="mt-3 text-sm font-bold" style={{ color: P.amber }}>
                Abrir importação (Excel) →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm border-separate border-spacing-0">
                <thead>
                  <tr style={{ background: "rgba(3,10,22,0.8)" }}>
                    {(["Pessoa", "Squad", "Gestor", "Salário", "Custo Zig", "M. Freel. 25", "Status", ""] as const).map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest align-middle"
                        style={{ color: P.dim, borderBottom: `1px solid ${P.borderSub}` }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < people.length - 1 ? `1px solid ${P.borderSub}` : "none" }}>
                      <td className="px-3 py-2.5 text-center align-middle">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <div className="font-semibold" style={{ color: P.text }}>{p.name}</div>
                          <div className="text-xs max-w-[220px]" style={{ color: P.muted }}>{p.role}{p.region ? ` · ${p.region}` : ""}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle">
                        <div className="inline-flex justify-center">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: P.accentBg, color: P.accent, border: `1px solid ${P.accentBorder}` }}>
                            {p.squad}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle max-w-[12rem]">
                        <EditableText value={p.managerName} placeholder="— preencher —" color={P.muted} onChange={(v) => updatePerson(p.id, { managerName: v.trim() })} />
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle">
                        <EditableMoney value={p.currentSalary} color={P.amber} onChange={(n) => updatePerson(p.id, { currentSalary: n })} />
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle">
                        <EditableMoney value={p.zigTotalCost} color={P.violet} onChange={(n) => updatePerson(p.id, { zigTotalCost: n })} />
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle">
                        <EditableMoney value={p.freelanceAverage2025} color={P.cyan} onChange={(n) => updatePerson(p.id, { freelanceAverage2025: Math.max(0, n) })} />
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle">
                        <select
                          value={p.status}
                          onChange={(e) => updatePerson(p.id, { status: e.target.value as PersonStatus })}
                          className="text-[11px] font-bold inline-flex px-2 py-0.5 rounded-md cursor-pointer outline-none"
                          style={{ background: STATUS_STYLE[p.status].bg, color: STATUS_STYLE[p.status].color, border: `1px solid ${STATUS_STYLE[p.status].border}` }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s} style={{ background: "#050e1f", color: P.text }}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle w-[1%]">
                        <button
                          onClick={() => removePerson(p.id)}
                          className="text-xs font-medium px-2.5 py-1 rounded-md"
                          style={{ border: `1px solid rgba(255,68,102,0.2)`, color: "#ff4466", background: "rgba(255,68,102,0.05)" }}
                          type="button"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlowSection>
      </div>
    </div>
  );
}

function Kpi({ label, v, sub, accent }: { label: string; v: string; sub?: string; accent: string }) {
  return (
    <div className="relative rounded-xl p-5" style={{ background: "rgba(4,12,26,0.97)", border: `1px solid ${accent}20`, boxShadow: `0 0 20px ${accent}0a` }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: accent, opacity: 0.6 }}>{label}</p>
      <p className="text-2xl font-black tabular-nums leading-none" style={{ color: accent, textShadow: `0 0 18px ${accent}99, 0 0 40px ${accent}44` }}>{v}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: accent, opacity: 0.4 }}>{sub}</p>}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: P.muted }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={INPUT} />
    </div>
  );
}

function NumField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: P.muted }}>{label}</label>
      <input type="number" inputMode="decimal" min={0} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2.5 text-sm tabular-nums outline-none" style={INPUT} />
    </div>
  );
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function EditableText({ value, placeholder, color, onChange }: { value: string; placeholder?: string; color: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  function commit() { setEditing(false); if (draft !== value) onChange(draft); }

  if (!editing) {
    const empty = !value?.trim();
    return (
      <button type="button" onClick={() => setEditing(true)} className="w-full text-xs truncate text-center hover:underline" title={empty ? "Clique para preencher" : value} style={{ color: empty ? "#2a5070" : color }}>
        {empty ? placeholder ?? "—" : value}
      </button>
    );
  }
  return (
    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
      placeholder={placeholder} className="w-full text-xs text-center rounded px-1 py-0.5 outline-none"
      style={{ background: P.inputBg, color: P.text, border: `1px solid ${P.inputBorder}` }}
    />
  );
}

function EditableMoney({ value, color, onChange }: { value: number; color: string; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value || 0));

  useEffect(() => { if (!editing) setDraft(String(value || 0)); }, [value, editing]);

  function commit() {
    setEditing(false);
    const n = Number(String(draft).replace(",", "."));
    if (Number.isFinite(n) && n !== value) onChange(n);
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="w-full text-center tabular-nums font-medium hover:underline" title="Clique para editar" style={{ color: value === 0 ? "#2a5070" : color }}>
        {value === 0 ? "— preencher —" : formatBRL(value)}
      </button>
    );
  }
  return (
    <input autoFocus type="number" inputMode="decimal" min={0} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value || 0)); setEditing(false); } }}
      className="w-full text-center tabular-nums rounded px-1 py-0.5 outline-none"
      style={{ background: P.inputBg, color: P.text, border: `1px solid ${P.inputBorder}` }}
    />
  );
}
