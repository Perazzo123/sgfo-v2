"use client";

import { useEffect, useState } from "react";

type BacklogItem = {
  id: number; title: string; responsible: string;
  what: string; why: string; how: string;
  gravity: number; urgency: number; tendency: number;
  status: "Aberto" | "Em andamento" | "Concluído";
};

const B = {
  accent: "#a855f7",
  accentBg: "rgba(168,85,247,0.05)",
  accentBorder: "rgba(168,85,247,0.15)",
  cyan: "#06d6f5",
  cyanBg: "rgba(6,214,245,0.05)",
  cyanBorder: "rgba(6,214,245,0.15)",
  amber: "#ffb700",
  amberBg: "rgba(255,183,0,0.06)",
  amberBorder: "rgba(255,183,0,0.2)",
  green: "#00ff88",
  greenBg: "rgba(0,255,136,0.05)",
  greenBorder: "rgba(0,255,136,0.15)",
  red: "#ff4466",
  redBg: "rgba(255,68,102,0.05)",
  redBorder: "rgba(255,68,102,0.15)",
  text: "#c8e8ff",
  muted: "#4a7a9a",
  dim: "#2a5070",
  inputBg: "#050e1f",
  inputBorder: "#0d2040",
  borderSub: "#081630",
};

const STATUS_STYLE: Record<BacklogItem["status"], { bg: string; color: string; border: string }> = {
  "Aberto":       { bg: B.cyanBg,  color: B.cyan,  border: B.cyanBorder  },
  "Em andamento": { bg: B.amberBg, color: B.amber, border: B.amberBorder },
  "Concluído":    { bg: B.greenBg, color: B.green, border: B.greenBorder },
};

function gutStyle(score: number): { bg: string; color: string; border: string } {
  if (score >= 64) return { bg: B.redBg,   color: B.red,   border: B.redBorder   };
  if (score >= 27) return { bg: B.amberBg, color: B.amber, border: B.amberBorder };
  return                   { bg: B.greenBg, color: B.green, border: B.greenBorder };
}

function GlowSection({
  accent = "#a855f7",
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

export default function BacklogPage() {
  const [items, setItems] = useState<BacklogItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("sgfo.backlog.items.v1");
      if (raw) return JSON.parse(raw) as BacklogItem[];
    } catch { /* no-op */ }
    return [];
  });

  useEffect(() => {
    try { window.localStorage.setItem("sgfo.backlog.items.v1", JSON.stringify(items)); } catch { /* no-op */ }
  }, [items]);

  const [title, setTitle] = useState("");
  const [responsible, setResponsible] = useState("");
  const [what, setWhat] = useState("");
  const [why, setWhy] = useState("");
  const [how, setHow] = useState("");
  const [gravity, setGravity] = useState(3);
  const [urgency, setUrgency] = useState(3);
  const [tendency, setTendency] = useState(3);

  function addItem() {
    if (!title || !responsible || !what) return;
    setItems([...items, { id: Date.now(), title, responsible, what, why, how, gravity, urgency, tendency, status: "Aberto" }]);
    setTitle(""); setResponsible(""); setWhat(""); setWhy(""); setHow("");
    setGravity(3); setUrgency(3); setTendency(3);
  }

  function updateStatus(id: number, status: BacklogItem["status"]) {
    setItems(items.map((i) => i.id === id ? { ...i, status } : i));
  }

  function removeItem(id: number) {
    setItems(items.filter((i) => i.id !== id));
  }

  const sorted = [...items].sort((a, b) => b.gravity * b.urgency * b.tendency - a.gravity * a.urgency * a.tendency);
  const open       = items.filter((i) => i.status === "Aberto").length;
  const inProgress = items.filter((i) => i.status === "Em andamento").length;
  const done       = items.filter((i) => i.status === "Concluído").length;
  const topScore   = sorted[0] ? sorted[0].gravity * sorted[0].urgency * sorted[0].tendency : 0;
  const curScore   = gravity * urgency * tendency;
  const curGs      = gutStyle(curScore);

  return (
    <div className="min-h-full" style={{ background: "radial-gradient(ellipse at 70% 0%, #0d0720 0%, #030b18 55%, #020810 100%)" }}>

      {/* Header */}
      <div className="px-8 py-5 flex items-center justify-between" style={{
        background: "rgba(3,10,22,0.95)",
        borderBottom: "1px solid rgba(168,85,247,0.1)",
        backdropFilter: "blur(8px)",
      }}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] mb-1" style={{ color: "#ffb700", opacity: 0.75 }}>SGFO · Módulo</p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: "#c8e8ff", textShadow: "0 0 30px rgba(168,85,247,0.25)" }}>
            Backlog 5W2H + GUT
          </h1>
        </div>
        <p className="text-xs font-bold" style={{ color: B.accent, opacity: 0.5 }}>Priorizado por Gravidade × Urgência × Tendência</p>
      </div>

      <div className="p-8 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GlowSection accent={B.cyan}>
            <div className="px-5 py-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: B.cyan, opacity: 0.6 }}>Ações abertas</p>
              <p className="text-3xl font-black tabular-nums leading-none" style={{ color: B.cyan, textShadow: `0 0 18px ${B.cyan}99, 0 0 40px ${B.cyan}44` }}>{open}</p>
            </div>
          </GlowSection>
          <GlowSection accent={B.amber}>
            <div className="px-5 py-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: B.amber, opacity: 0.6 }}>Em andamento</p>
              <p className="text-3xl font-black tabular-nums leading-none" style={{ color: B.amber, textShadow: `0 0 18px ${B.amber}99, 0 0 40px ${B.amber}44` }}>{inProgress}</p>
            </div>
          </GlowSection>
          <GlowSection accent={B.green}>
            <div className="px-5 py-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: B.green, opacity: 0.6 }}>Concluídas</p>
              <p className="text-3xl font-black tabular-nums leading-none" style={{ color: B.green, textShadow: `0 0 18px ${B.green}99, 0 0 40px ${B.green}44` }}>{done}</p>
            </div>
          </GlowSection>
          <GlowSection accent={gutStyle(topScore).color}>
            <div className="px-5 py-5">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: gutStyle(topScore).color, opacity: 0.6 }}>Maior GUT</p>
              <p className="text-3xl font-black tabular-nums leading-none" style={{ color: gutStyle(topScore).color, textShadow: `0 0 18px ${gutStyle(topScore).color}99` }}>
                {topScore || "—"}
              </p>
            </div>
          </GlowSection>
        </div>

        {/* Form */}
        <GlowSection accent={B.amber} className="p-6">
          <div>
            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: `1px solid rgba(255,183,0,0.1)` }}>
              <span className="block w-[2px] h-4 rounded-full" style={{ background: B.amber, boxShadow: `0 0 8px ${B.amber}` }} />
              <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: B.amber, textShadow: `0 0 12px ${B.amber}55` }}>Nova ação 5W2H</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormField label="Título *" value={title} onChange={setTitle} placeholder="Ex: Revisar processo de compras" />
              <FormField label="Responsável *" value={responsible} onChange={setResponsible} placeholder="Nome do responsável" />
              <FormField label="O que? (What) *" value={what} onChange={setWhat} placeholder="Descreva a ação" />
              <FormField label="Por quê? (Why)" value={why} onChange={setWhy} placeholder="Motivação / problema" />
              <FormField label="Como? (How)" value={how} onChange={setHow} placeholder="Método / abordagem" />

              {/* GUT */}
              <div className="relative rounded-xl p-4" style={{ background: curGs.bg, border: `1px solid ${curGs.border}`, boxShadow: `0 0 20px ${curGs.color}0a` }}>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: curGs.color, opacity: 0.7 }}>Matriz GUT (1–5)</label>
                  <span className="text-sm font-black tabular-nums px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.4)", color: curGs.color, textShadow: `0 0 10px ${curGs.color}88` }}>
                    {curScore} pts
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "G · Gravidade", val: gravity, set: setGravity },
                    { label: "U · Urgência",  val: urgency, set: setUrgency },
                    { label: "T · Tendência", val: tendency, set: setTendency },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="block text-[10px] font-bold mb-1" style={{ color: curGs.color, opacity: 0.6 }}>{label}</label>
                      <input
                        type="number" min={1} max={5} value={val}
                        onChange={(e) => set(Number(e.target.value))}
                        className="w-full rounded-lg px-2 py-2 text-sm tabular-nums outline-none text-center font-black"
                        style={{ background: B.inputBg, border: `1px solid ${curGs.border}`, color: curGs.color }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={addItem}
              className="rounded-lg px-5 py-2.5 text-sm font-black"
              style={{ background: B.amberBg, color: B.amber, border: `1px solid ${B.amberBorder}`, boxShadow: "0 0 14px rgba(255,183,0,0.15)" }}
            >
              Adicionar ação
            </button>
          </div>
        </GlowSection>

        {/* Backlog list */}
        <GlowSection accent={B.accent} className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid rgba(168,85,247,0.1)` }}>
            <div className="flex items-center gap-2">
              <span className="block w-[2px] h-4 rounded-full" style={{ background: B.accent, boxShadow: `0 0 8px ${B.accent}` }} />
              <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: B.accent, textShadow: `0 0 12px ${B.accent}55` }}>Backlog priorizado</h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: B.accentBg, color: B.accent, border: `1px solid ${B.accentBorder}` }}>
              {items.length} {items.length === 1 ? "ação" : "ações"}
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-sm" style={{ color: B.muted }}>Nenhuma ação cadastrada.</p>
              <p className="text-xs mt-1" style={{ color: B.dim }}>Use o formulário acima para adicionar.</p>
            </div>
          ) : (
            <>
              <div
                className="hidden md:grid md:grid-cols-[64px_1fr_140px_36px_36px_36px_140px_36px] gap-4 px-6 py-3"
                style={{ background: "rgba(3,10,22,0.8)", borderBottom: `1px solid ${B.borderSub}` }}
              >
                {["GUT", "Ação · Responsável", "O que", "G", "U", "T", "Status", ""].map((h) => (
                  <p key={h} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: B.dim }}>{h}</p>
                ))}
              </div>

              {sorted.map((item, i) => {
                const score = item.gravity * item.urgency * item.tendency;
                const gs = gutStyle(score);
                const ss = STATUS_STYLE[item.status];
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 md:grid-cols-[64px_1fr_140px_36px_36px_36px_140px_36px] gap-3 md:gap-4 items-center px-6 py-4"
                    style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${B.borderSub}` : "none" }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black"
                      style={{ background: gs.bg, color: gs.color, border: `1px solid ${gs.border}`, textShadow: `0 0 10px ${gs.color}88` }}
                    >
                      {score}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: B.text }}>{item.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: B.muted }}>{item.responsible}{item.why ? ` · ${item.why}` : ""}</p>
                    </div>
                    <p className="text-sm truncate" style={{ color: B.muted }}>{item.what}</p>
                    {[item.gravity, item.urgency, item.tendency].map((v, idx) => (
                      <span key={idx} className="text-sm font-black tabular-nums text-center" style={{ color: B.text }}>{v}</span>
                    ))}
                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value as BacklogItem["status"])}
                      className="rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none cursor-pointer w-full"
                      style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                    >
                      <option>Aberto</option>
                      <option>Em andamento</option>
                      <option>Concluído</option>
                    </select>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                      style={{ color: B.dim }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = B.red; (e.currentTarget as HTMLElement).style.background = B.redBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = B.dim; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </GlowSection>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: B.muted }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: B.inputBg, border: `1px solid ${B.inputBorder}`, color: B.text }} />
    </div>
  );
}
