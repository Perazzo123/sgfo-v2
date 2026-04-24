"use client";

import { useState } from "react";

type BacklogItem = {
  id: number; title: string; responsible: string;
  what: string; why: string; how: string;
  gravity: number; urgency: number; tendency: number;
  status: "Aberto" | "Em andamento" | "Concluído";
};

const S = {
  bg: "#151a27", surface: "#1d2436", surfaceHigh: "#222c40",
  border: "#2a3550", borderSub: "#1e2a42",
  text: "#e2e8f5", muted: "#7a90b8", dim: "#4a6fa5",
  amber: "#f59e0b", amberLight: "#fbbf24", amberBg: "#211c0e", amberBorder: "#3a2e0f",
  inputBg: "#12192a",
};

const STATUS_STYLE: Record<BacklogItem["status"], { bg: string; color: string; border: string }> = {
  "Aberto":       { bg: "#0d1829", color: "#60a5fa", border: "#1a2e4a" },
  "Em andamento": { bg: "#211c0e", color: "#fbbf24", border: "#3a2e0f" },
  "Concluído":    { bg: "#0d1f18", color: "#34d399", border: "#1a3a2a" },
};

function gutStyle(score: number): { bg: string; color: string; border: string } {
  if (score >= 64) return { bg: "#1f0d0d", color: "#f87171", border: "#3a1a1a" };
  if (score >= 27) return { bg: "#211c0e", color: "#fbbf24", border: "#3a2e0f" };
  return { bg: "#0d1f18", color: "#34d399", border: "#1a3a2a" };
}

export default function BacklogPage() {
  const [items, setItems] = useState<BacklogItem[]>([]);
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

  const open = items.filter((i) => i.status === "Aberto").length;
  const inProgress = items.filter((i) => i.status === "Em andamento").length;
  const done = items.filter((i) => i.status === "Concluído").length;
  const topScore = sorted[0] ? sorted[0].gravity * sorted[0].urgency * sorted[0].tendency : 0;
  const curScore = gravity * urgency * tendency;
  const curGs = gutStyle(curScore);

  return (
    <div className="min-h-full" style={{ background: S.bg }}>

      {/* Top bar */}
      <div className="px-8 py-5 flex items-center justify-between" style={{ background: "#111827", borderBottom: "1px solid #1a2235" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: S.amber }}>SGFO · Módulo</p>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: S.text }}>Backlog 5W2H + GUT</h1>
        </div>
        <p className="text-xs" style={{ color: S.muted }}>Priorizado por Gravidade × Urgência × Tendência</p>
      </div>

      <div className="p-8 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl p-5" style={{ background: "#0d1829", border: "1px solid #1a2e4a" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#3b82f6" }}>Ações abertas</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "#93c5fd" }}>{open}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: S.amberBg, border: `1px solid ${S.amberBorder}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: S.amber }}>Em andamento</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: S.amberLight }}>{inProgress}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: "#0d1f18", border: "1px solid #1a3a2a" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#10b981" }}>Concluídas</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "#34d399" }}>{done}</p>
          </div>
          <div className="rounded-xl p-5" style={gutStyle(topScore)}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: gutStyle(topScore).color }}>Maior GUT</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: gutStyle(topScore).color }}>{topScore || "—"}</p>
          </div>
        </div>

        {/* Form */}
        <section className="rounded-xl p-6" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
          <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: `1px solid ${S.borderSub}` }}>
            <div className="w-1 h-4 rounded-full" style={{ background: S.amber }} />
            <h2 className="text-sm font-bold" style={{ color: S.text }}>Nova ação 5W2H</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField label="Título *" value={title} onChange={setTitle} placeholder="Ex: Revisar processo de compras" />
            <FormField label="Responsável *" value={responsible} onChange={setResponsible} placeholder="Nome do responsável" />
            <FormField label="O que? (What) *" value={what} onChange={setWhat} placeholder="Descreva a ação" />
            <FormField label="Por quê? (Why)" value={why} onChange={setWhy} placeholder="Motivação / problema" />
            <FormField label="Como? (How)" value={how} onChange={setHow} placeholder="Método / abordagem" />

            {/* GUT */}
            <div className="rounded-xl p-4" style={{ background: curGs.bg, border: `1px solid ${curGs.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: curGs.color }}>
                  Matriz GUT (1–5)
                </label>
                <span className="text-sm font-black tabular-nums px-2.5 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.3)", color: curGs.color }}>
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
                    <label className="block text-[10px] font-medium mb-1" style={{ color: curGs.color, opacity: 0.7 }}>{label}</label>
                    <input
                      type="number" min={1} max={5} value={val}
                      onChange={(e) => set(Number(e.target.value))}
                      className="w-full rounded-lg px-2 py-2 text-sm tabular-nums outline-none text-center font-bold"
                      style={{ background: S.inputBg, border: `1px solid ${curGs.border}`, color: curGs.color }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={addItem}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold"
            style={{ background: S.amberBg, color: S.amberLight, border: `1px solid ${S.amberBorder}` }}
          >
            Adicionar ação
          </button>
        </section>

        {/* List */}
        <section className="rounded-xl overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ background: S.surfaceHigh, borderBottom: `1px solid ${S.border}` }}>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ background: S.amber }} />
              <h2 className="text-sm font-bold" style={{ color: S.text }}>Backlog priorizado</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#170d29", color: "#a78bfa", border: "1px solid #2a1845" }}>
              {items.length} {items.length === 1 ? "ação" : "ações"}
            </span>
          </div>

          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-sm" style={{ color: S.muted }}>Nenhuma ação cadastrada.</p>
              <p className="text-xs mt-1" style={{ color: S.dim }}>Use o formulário acima para adicionar.</p>
            </div>
          ) : (
            <>
              <div
                className="hidden md:grid md:grid-cols-[64px_1fr_140px_36px_36px_36px_140px_36px] gap-4 px-6 py-3"
                style={{ background: "#111827", borderBottom: `1px solid ${S.borderSub}` }}
              >
                {["GUT", "Ação · Responsável", "O que", "G", "U", "T", "Status", ""].map((h) => (
                  <p key={h} className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.dim }}>{h}</p>
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
                    style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${S.borderSub}` : "none" }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black"
                      style={{ background: gs.bg, color: gs.color, border: `1px solid ${gs.border}` }}
                    >
                      {score}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: S.text }}>{item.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: S.muted }}>{item.responsible}{item.why ? ` · ${item.why}` : ""}</p>
                    </div>
                    <p className="text-sm truncate" style={{ color: S.muted }}>{item.what}</p>
                    {[item.gravity, item.urgency, item.tendency].map((v, idx) => (
                      <span key={idx} className="text-sm font-bold tabular-nums text-center" style={{ color: S.text }}>{v}</span>
                    ))}
                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value as BacklogItem["status"])}
                      className="rounded-lg px-2 py-1.5 text-[11px] font-semibold outline-none cursor-pointer w-full"
                      style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}
                    >
                      <option>Aberto</option>
                      <option>Em andamento</option>
                      <option>Concluído</option>
                    </select>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                      style={{ color: S.dim }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f87171"; (e.currentTarget as HTMLElement).style.background = "#1f0d0d"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = S.dim; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
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
        </section>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#4a5a7a" }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: "#12192a", border: "1px solid #2a3550", color: "#e2e8f5" }} />
    </div>
  );
}
