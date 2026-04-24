"use client";

import { useState } from "react";

type CostEntry = { id: number; category: string; description: string; amount: number; justification: string };

const BUDGET = 30000;
const CATEGORIES = ["Mão de Obra", "Transporte", "Hospedagem", "Alimentação", "Frete", "Outros"];

const S = {
  bg: "#151a27", surface: "#1d2436", surfaceHigh: "#222c40",
  border: "#2a3550", borderSub: "#1e2a42",
  text: "#e2e8f5", muted: "#7a90b8", dim: "#4a6fa5",
  amber: "#f59e0b", amberLight: "#fbbf24", amberBg: "#211c0e", amberBorder: "#3a2e0f",
  inputBg: "#12192a",
};

const CAT_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  "Mão de Obra": { bg: "#0d1829", color: "#60a5fa", border: "#1a2e4a" },
  Transporte:    { bg: "#0d1a29", color: "#38bdf8", border: "#1a3045" },
  Hospedagem:    { bg: "#170d29", color: "#a78bfa", border: "#2a1845" },
  Alimentação:   { bg: "#211c0e", color: "#fbbf24", border: "#3a2e0f" },
  Frete:         { bg: "#0d1f18", color: "#34d399", border: "#1a3a2a" },
  Outros:        { bg: "#1d2436", color: "#6b7fa3", border: "#2a3550" },
};

export default function CostsPage() {
  const [entries, setEntries] = useState<CostEntry[]>([
    { id: 1, category: "Mão de Obra", description: "Freelancer setup", amount: 5000, justification: "Setup adicional aprovado para operação." },
    { id: 2, category: "Transporte",  description: "Van equipe",        amount: 3000, justification: "Deslocamento operacional." },
  ]);
  const [category, setCategory] = useState("Mão de Obra");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");

  const consumed = entries.reduce((s, e) => s + e.amount, 0);
  const balance = BUDGET - consumed;
  const pct = Math.min((consumed / BUDGET) * 100, 100);
  const isOver = balance < 0;

  function addEntry() {
    const n = Number(amount);
    if (!description || !justification || !n) return;
    setEntries([...entries, { id: Date.now(), category, description, amount: n, justification }]);
    setDescription(""); setAmount(""); setJustification("");
  }

  function removeEntry(id: number) {
    setEntries(entries.filter((e) => e.id !== id));
  }

  return (
    <div className="min-h-full" style={{ background: S.bg }}>

      {/* Top bar */}
      <div className="px-8 py-5 flex items-center justify-between" style={{ background: "#111827", borderBottom: "1px solid #1a2235" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: S.amber }}>SGFO · Módulo</p>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: S.text }}>Gestão de Custos</h1>
        </div>
        <button
          onClick={addEntry}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ background: S.amberBg, color: S.amberLight, border: `1px solid ${S.amberBorder}` }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo lançamento
        </button>
      </div>

      <div className="p-8 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ background: "#0d1829", border: "1px solid #1a2e4a" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#3b82f6" }}>Budget Total</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "#93c5fd" }}>R$ {BUDGET.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: S.amberBg, border: `1px solid ${S.amberBorder}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: S.amber }}>Consumido</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: S.amberLight }}>R$ {consumed.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: isOver ? "#1f0d0d" : "#0d1f18", border: `1px solid ${isOver ? "#3a1a1a" : "#1a3a2a"}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: isOver ? "#f87171" : "#10b981" }}>Saldo Disponível</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: isOver ? "#fca5a5" : "#34d399" }}>
              R$ {Math.abs(balance).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-xl px-6 py-5" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: S.muted }}>Execução do Budget</p>
              <p className="text-sm" style={{ color: S.muted }}>R$ {consumed.toLocaleString("pt-BR")} de R$ {BUDGET.toLocaleString("pt-BR")}</p>
            </div>
            <span
              className="text-sm font-bold px-3 py-1 rounded-full tabular-nums"
              style={{ background: pct > 85 ? "#1f0d0d" : S.amberBg, color: pct > 85 ? "#f87171" : S.amberLight }}
            >
              {pct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#111827" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: pct > 85 ? "linear-gradient(90deg, #f97316, #ef4444)" : "linear-gradient(90deg, #f59e0b, #fbbf24)" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Form */}
          <section className="lg:col-span-2 rounded-xl p-6" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: `1px solid ${S.borderSub}` }}>
              <div className="w-1 h-4 rounded-full" style={{ background: S.amber }} />
              <h2 className="text-sm font-bold" style={{ color: S.text }}>Novo lançamento</h2>
            </div>
            <div className="space-y-4">
              {(["Categoria", "Valor (R$)", "Descrição", "Justificativa"] as const).map((lbl) => (
                <div key={lbl}>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: S.muted }}>{lbl}</label>
                  {lbl === "Categoria" ? (
                    <select
                      value={category} onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                      style={{ background: S.inputBg, border: `1px solid ${S.border}`, color: S.text }}
                    >
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input
                      value={lbl === "Valor (R$)" ? amount : lbl === "Descrição" ? description : justification}
                      onChange={(e) => lbl === "Valor (R$)" ? setAmount(e.target.value) : lbl === "Descrição" ? setDescription(e.target.value) : setJustification(e.target.value)}
                      type={lbl === "Valor (R$)" ? "number" : "text"}
                      placeholder={lbl === "Valor (R$)" ? "0" : `Ex: ${lbl === "Descrição" ? "Freelancer de setup" : "Aprovado pela operação"}`}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                      style={{ background: S.inputBg, border: `1px solid ${S.border}`, color: S.text }}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addEntry}
              className="mt-5 w-full rounded-lg py-2.5 text-sm font-semibold"
              style={{ background: S.amberBg, color: S.amberLight, border: `1px solid ${S.amberBorder}` }}
            >
              Adicionar custo
            </button>
          </section>

          {/* Entries */}
          <section className="lg:col-span-3 rounded-xl overflow-hidden" style={{ background: S.surface, border: `1px solid ${S.border}` }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ background: S.surfaceHigh, borderBottom: `1px solid ${S.border}` }}>
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full" style={{ background: S.amber }} />
                <h2 className="text-sm font-bold" style={{ color: S.text }}>Lançamentos</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: S.amberBg, color: S.amberLight, border: `1px solid ${S.amberBorder}` }}>
                {entries.length} {entries.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <p className="text-sm" style={{ color: S.muted }}>Nenhum lançamento registrado.</p>
              </div>
            ) : (
              <>
                <div className="hidden sm:grid sm:grid-cols-[150px_1fr_1fr_120px_36px] gap-4 px-6 py-3" style={{ background: "#111827", borderBottom: `1px solid ${S.borderSub}` }}>
                  {["Categoria", "Descrição", "Justificativa", "Valor", ""].map((h) => (
                    <span key={h} className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: S.dim }}>{h}</span>
                  ))}
                </div>
                {entries.map((entry, i) => {
                  const cs = CAT_STYLE[entry.category] ?? CAT_STYLE["Outros"];
                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-1 sm:grid-cols-[150px_1fr_1fr_120px_36px] gap-3 sm:gap-4 items-center px-6 py-4"
                      style={{ borderBottom: i < entries.length - 1 ? `1px solid ${S.borderSub}` : "none" }}
                    >
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-md inline-block w-fit" style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                        {entry.category}
                      </span>
                      <p className="text-sm truncate" style={{ color: S.text }}>{entry.description}</p>
                      <p className="text-sm truncate" style={{ color: S.muted }}>{entry.justification}</p>
                      <p className="text-sm font-semibold tabular-nums" style={{ color: S.amberLight }}>
                        R$ {entry.amount.toLocaleString("pt-BR")}
                      </p>
                      <button
                        onClick={() => removeEntry(entry.id)}
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
    </div>
  );
}
