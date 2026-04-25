"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadProjectsStore, getActiveProject } from "@/lib/costs/storage";
import { loadPeopleFromStorage } from "@/lib/people/storage";

type BacklogItem = {
  id: number; gravity: number; urgency: number; tendency: number;
  status: "Aberto" | "Em andamento" | "Concluído";
};

type SgfoSnapshot = {
  app: "sgfo-v2";
  exportedAt: string;
  keys: Record<string, string>;
};

function collectSgfoKeys(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const keys: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith("sgfo.")) continue;
    const v = window.localStorage.getItem(k);
    if (v !== null) keys[k] = v;
  }
  return keys;
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

// ── Glow card with corner brackets ───────────────────────────────────────────
function GlowCard({ accent, children, className = "" }: {
  accent: string; children: React.ReactNode; className?: string;
}) {
  const br = 6;
  const cs = 14; // corner size
  return (
    <div className={`relative ${className}`} style={{
      background: "rgba(4, 12, 26, 0.97)",
      border: `1px solid ${accent}28`,
      borderRadius: br,
      boxShadow: `0 0 32px ${accent}18, 0 0 0 1px ${accent}10 inset`,
    }}>
      {/* corners */}
      {[
        { top: 0, left: 0,   borderTop: `2px solid ${accent}`, borderLeft:  `2px solid ${accent}`, borderTopLeftRadius:     br },
        { top: 0, right: 0,  borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, borderTopRightRadius:    br },
        { bottom: 0, left: 0,  borderBottom: `2px solid ${accent}`, borderLeft:  `2px solid ${accent}`, borderBottomLeftRadius:  br },
        { bottom: 0, right: 0, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, borderBottomRightRadius: br },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: cs, height: cs, ...s }} />
      ))}
      {children}
    </div>
  );
}

// ── Neon label ────────────────────────────────────────────────────────────────
function Label({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
      style={{ color, opacity: 0.65 }}>{children}</p>
  );
}

// ── Glowing big number ────────────────────────────────────────────────────────
function Glow({ value, color, size = "4xl" }: { value: string; color: string; size?: string }) {
  return (
    <p className={`text-${size} font-black tabular-nums leading-none`} style={{
      color,
      textShadow: `0 0 18px ${color}99, 0 0 48px ${color}44`,
    }}>{value}</p>
  );
}

// ── Small stat row ────────────────────────────────────────────────────────────
function Row({ label, value, color = "#3a6090" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid #0a1a2e" }}>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#2a5070" }}>{label}</span>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Donut ring ────────────────────────────────────────────────────────────────
function Ring({ pct, color }: { pct: number; color: string }) {
  const deg = Math.min(pct, 100) * 3.6;
  const trail = "#0a1a2e";
  return (
    <div style={{
      width: 96, height: 96, borderRadius: "50%", flexShrink: 0,
      background: `conic-gradient(${color} ${deg}deg, ${trail} ${deg}deg)`,
      boxShadow: `0 0 24px ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 68, height: 68, borderRadius: "50%",
        background: "rgba(4,12,26,0.97)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 1,
      }}>
        <span style={{ fontSize: 15, fontWeight: 900, color, lineHeight: 1,
          textShadow: `0 0 10px ${color}cc` }}>
          {pct > 0 ? `${pct.toFixed(0)}%` : "·"}
        </span>
        <span style={{ fontSize: 8, fontWeight: 700, color, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>exec</span>
      </div>
    </div>
  );
}

// ── Segmented bar ─────────────────────────────────────────────────────────────
function SegBar({ open, wip, done, total }: { open: number; wip: number; done: number; total: number }) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-[5px] rounded-full" style={{ background: "#0a1a2e" }} />
        <span className="text-[10px]" style={{ color: "#1e3050" }}>sem dados</span>
      </div>
    );
  }
  return (
    <div>
      <div className="flex h-[5px] rounded-full overflow-hidden gap-[2px] mb-3" style={{ background: "#0a1a2e" }}>
        {open > 0 && <div style={{ flex: open, background: "#06d6f5", boxShadow: "0 0 6px #06d6f588" }} />}
        {wip  > 0 && <div style={{ flex: wip,  background: "#ffb700", boxShadow: "0 0 6px #ffb70088" }} />}
        {done > 0 && <div style={{ flex: done, background: "#00ff88", boxShadow: "0 0 6px #00ff8888" }} />}
      </div>
      <div className="flex gap-4">
        {[["#06d6f5", "Abertas", open], ["#ffb700", "Andamento", wip], ["#00ff88", "Concluídas", done]].map(([c, l, v]) => (
          <div key={String(l)} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-sm" style={{ background: String(c), display: "inline-block", boxShadow: `0 0 4px ${c}` }} />
            <span className="text-[10px]" style={{ color: "#2a5070" }}>{l} <strong style={{ color: String(c) }}>{v}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [ready, setReady]               = useState(false);
  const [budgetTotal, setBudgetTotal]   = useState(0);
  const [consumed, setConsumed]         = useState(0);
  const [entriesCount, setEntriesCount] = useState(0);
  const [people, setPeople]             = useState<ReturnType<typeof loadPeopleFromStorage>>([]);
  const [backlog, setBacklog]           = useState<BacklogItem[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const store = loadProjectsStore();
    const proj  = getActiveProject(store);
    const pe    = proj?.entries ?? [];
    setBudgetTotal(proj?.budget.total ?? 0);
    setConsumed(pe.reduce((s, e) => s + e.amount, 0));
    setEntriesCount(pe.length);
    setPeople(loadPeopleFromStorage());
    try {
      const bl = window.localStorage.getItem("sgfo.backlog.items.v1");
      if (bl) setBacklog(JSON.parse(bl));
    } catch { /* no-op */ }
    setReady(true);
  }, []);

  const saldo   = budgetTotal - consumed;
  const pctExec = budgetTotal > 0 ? (consumed / budgetTotal) * 100 : 0;
  const isOver  = saldo < 0;

  const active    = people.filter((p) => p.status === "Ativo");
  const headcount = active.length;
  const totalZig  = active.reduce((s, p) => s + p.zigTotalCost, 0);
  const totalSal  = active.reduce((s, p) => s + p.currentSalary, 0);
  const squads    = new Set(active.map((p) => p.squad || "—")).size;
  const multiplo  = totalSal > 0 ? totalZig / totalSal : 0;
  const disp      = people.length > 0 ? (active.length / people.length) * 100 : 0;

  const blOpen = backlog.filter((i) => i.status === "Aberto").length;
  const blWip  = backlog.filter((i) => i.status === "Em andamento").length;
  const blDone = backlog.filter((i) => i.status === "Concluído").length;
  const blAll  = backlog.length;
  const topGut = backlog.reduce((m, i) => Math.max(m, i.gravity * i.urgency * i.tendency), 0);
  const blPct  = blAll > 0 ? (blDone / blAll) * 100 : 0;

  const v = (n: string | number | null, fallback = "·") =>
    ready ? (n != null && n !== 0 ? String(n) : fallback) : "·";

  function onExportData() {
    const keys = collectSgfoKeys();
    const payload: SgfoSnapshot = {
      app: "sgfo-v2",
      exportedAt: new Date().toISOString(),
      keys,
    };
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadJsonFile(`sgfo-backup-${stamp}.json`, payload);
  }

  function onPickImportFile() {
    importRef.current?.click();
  }

  async function onImportData(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<SgfoSnapshot>;
      if (!parsed || typeof parsed !== "object" || parsed.app !== "sgfo-v2" || !parsed.keys) {
        alert("Arquivo inválido. Selecione um backup JSON exportado pelo SGFO.");
        return;
      }
      const ok = confirm(
        "Isso vai substituir todos os dados locais do SGFO neste navegador (custos, pessoas e backlog). Deseja continuar?"
      );
      if (!ok) return;

      // Limpa primeiro tudo que for SGFO para garantir que fique idêntico ao backup.
      const existingKeys = Object.keys(collectSgfoKeys());
      for (const k of existingKeys) window.localStorage.removeItem(k);
      for (const [k, v] of Object.entries(parsed.keys)) window.localStorage.setItem(k, String(v));

      alert("Backup importado com sucesso. A página será recarregada.");
      window.location.reload();
    } catch {
      alert("Falha ao importar arquivo. Verifique se é um JSON válido.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <div className="min-h-full" style={{
      background: "radial-gradient(ellipse at 60% 0%, #071428 0%, #030b18 55%, #020810 100%)",
    }}>

      {/* Top bar */}
      <div className="px-8 py-5 flex items-center justify-between" style={{
        background: "rgba(3,10,22,0.95)",
        borderBottom: "1px solid #06d6f520",
        backdropFilter: "blur(8px)",
      }}>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] mb-0.5" style={{ color: "#ffb700", opacity: 0.8 }}>SGFO · Sistema de Gestão v2</p>
            <h1 className="text-xl font-black tracking-tight" style={{
              color: "#c8e8ff",
              textShadow: "0 0 30px rgba(6,214,245,0.3)",
            }}>Dashboard</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => onImportData(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={onExportData}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "rgba(6,214,245,0.08)",
              border: "1px solid rgba(6,214,245,0.25)",
              color: "#06d6f5",
            }}
          >
            Exportar dados
          </button>
          <button
            type="button"
            onClick={onPickImportFile}
            className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "rgba(255,183,0,0.08)",
              border: "1px solid rgba(255,183,0,0.25)",
              color: "#ffb700",
            }}
          >
            Importar dados
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold" style={{
            background: "rgba(0,255,136,0.06)",
            border: "1px solid rgba(0,255,136,0.2)",
            color: "#00ff88",
            boxShadow: "0 0 16px rgba(0,255,136,0.1)",
          }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{
              background: "#00ff88",
              boxShadow: "0 0 8px #00ff88",
              animation: "pulse 2s infinite",
            }} />
            Sistema operacional · 2026
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">

        {/* ── Hero strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Budget total",    val: budgetTotal > 0 ? brl(budgetTotal) : "—", color: "#06d6f5" },
            { label: "Headcount ativo", val: v(headcount, "0"),                         color: "#00ff88" },
            { label: "Custo total Zig", val: totalZig > 0 ? brl(totalZig) : "—",        color: "#a855f7" },
            { label: "Ações abertas",   val: v(blOpen, "0"),                             color: "#ffb700" },
          ].map((k) => (
            <GlowCard key={k.label} accent={k.color}>
              <div className="px-5 py-5">
                <Label color={k.color}>{k.label}</Label>
                <Glow value={k.val} color={k.color} size="3xl" />
              </div>
            </GlowCard>
          ))}
        </div>

        {/* ── Module panels ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── CUSTOS ── */}
          <GlowCard accent="#06d6f5" className="flex flex-col">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #06d6f512" }}>
              <div className="flex items-center gap-2">
                <span className="block w-[2px] h-4 rounded-full" style={{ background: "#06d6f5", boxShadow: "0 0 8px #06d6f5" }} />
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#06d6f5", textShadow: "0 0 12px #06d6f555" }}>Custos</span>
              </div>
              <Link href="/costs" className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#06d6f580" }}>
                Ver módulo →
              </Link>
            </div>

            <div className="p-5 flex-1">
              <div className="flex items-center gap-5 mb-5">
                <Ring pct={pctExec} color={isOver ? "#ff4466" : "#06d6f5"} />
                <div>
                  <Label color="#ffb700">Realizado</Label>
                  <Glow value={brl(consumed)} color="#ffb700" size="2xl" />
                </div>
              </div>

              <div>
                <Row label="Budget total"  value={budgetTotal > 0 ? brl(budgetTotal) : "—"} color="#06d6f5" />
                <Row label="Saldo"         value={budgetTotal > 0 ? brl(Math.abs(saldo)) : "—"} color={isOver ? "#ff4466" : "#00ff88"} />
                <Row label="Execução"      value={budgetTotal > 0 ? `${pctExec.toFixed(1)}%` : "—"} color="#ffb700" />
                <Row label="Lançamentos"   value={v(entriesCount, "0")} />
              </div>
            </div>
          </GlowCard>

          {/* ── PESSOAS ── */}
          <GlowCard accent="#00ff88" className="flex flex-col">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #00ff8812" }}>
              <div className="flex items-center gap-2">
                <span className="block w-[2px] h-4 rounded-full" style={{ background: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#00ff88", textShadow: "0 0 12px #00ff8855" }}>Pessoas</span>
              </div>
              <Link href="/people" className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#00ff8880" }}>
                Ver módulo →
              </Link>
            </div>

            <div className="p-5 flex-1">
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <Label color="#00ff88">Headcount</Label>
                  <Glow value={v(headcount, "0")} color="#00ff88" size="4xl" />
                </div>
                <div>
                  <Label color="#a855f7">Custo total</Label>
                  <Glow value={totalZig > 0 ? brl(totalZig) : "—"} color="#a855f7" size="xl" />
                </div>
              </div>

              <div>
                <Row label="Ticket médio"    value={headcount > 0 ? brl(totalZig / headcount) : "—"} color="#ffb700" />
                <Row label="Squads"          value={v(squads, "0")}   color="#06d6f5" />
                <Row label="Múltiplo CLT"    value={multiplo > 0 ? `${multiplo.toFixed(2)}×` : "—"} color="#a855f7" />
                <Row label="Disponibilidade" value={people.length > 0 ? `${disp.toFixed(0)}%` : "—"} color={disp < 80 && people.length > 0 ? "#ff4466" : "#00ff88"} />
              </div>
            </div>
          </GlowCard>

          {/* ── BACKLOG ── */}
          <GlowCard accent="#a855f7" className="flex flex-col">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #a855f712" }}>
              <div className="flex items-center gap-2">
                <span className="block w-[2px] h-4 rounded-full" style={{ background: "#a855f7", boxShadow: "0 0 8px #a855f7" }} />
                <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#a855f7", textShadow: "0 0 12px #a855f755" }}>Backlog</span>
              </div>
              <Link href="/backlog" className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#a855f780" }}>
                Ver módulo →
              </Link>
            </div>

            <div className="p-5 flex-1">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div>
                  <Label color="#06d6f5">Abertas</Label>
                  <Glow value={v(blOpen, "0")} color="#06d6f5" size="3xl" />
                </div>
                <div>
                  <Label color="#ffb700">Andamento</Label>
                  <Glow value={v(blWip, "0")} color="#ffb700" size="3xl" />
                </div>
                <div>
                  <Label color="#00ff88">Concluídas</Label>
                  <Glow value={v(blDone, "0")} color="#00ff88" size="3xl" />
                </div>
              </div>

              <div className="mb-5">
                <SegBar open={blOpen} wip={blWip} done={blDone} total={blAll} />
              </div>

              <div>
                <Row label="Total ações" value={v(blAll, "0")} />
                <Row label="Conclusão"   value={blAll > 0 ? `${blPct.toFixed(0)}%` : "—"} color={blPct >= 50 ? "#00ff88" : "#ffb700"} />
                <Row label="Maior GUT"   value={topGut > 0 ? String(topGut) : "—"} color={topGut >= 64 ? "#ff4466" : topGut >= 27 ? "#ffb700" : "#00ff88"} />
              </div>
            </div>
          </GlowCard>

        </div>
      </div>
    </div>
  );
}
