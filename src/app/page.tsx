import Link from "next/link";

const S = {
  bg: "#151a27", surface: "#1d2436", border: "#2a3550",
  text: "#e2e8f5", muted: "#7a90b8", dim: "#4a6fa5",
  amber: "#f59e0b", amberLight: "#fbbf24", amberBg: "#211c0e", amberBorder: "#3a2e0f",
};

const modules = [
  {
    label: "Custos",
    href: "/costs",
    description: "Budget, lançamentos e saldo do projeto.",
    accent: "#60a5fa",
    accentBg: "#0d1829",
    accentBorder: "#1a2e4a",
    stat: "R$ 30.000",
    statLabel: "Budget",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: "Pessoas",
    href: "/people",
    description: "Equipe de campo e benchmark salarial.",
    accent: "#34d399",
    accentBg: "#0d1f18",
    accentBorder: "#1a3a2a",
    stat: "—",
    statLabel: "Headcount",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Backlog",
    href: "/backlog",
    description: "Ações priorizadas por GUT e 5W2H.",
    accent: "#a78bfa",
    accentBg: "#170d29",
    accentBorder: "#2a1845",
    stat: "—",
    statLabel: "Ações abertas",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-full" style={{ background: S.bg }}>

      {/* Top bar */}
      <div className="px-8 py-5 flex items-center justify-between" style={{ background: "#111827", borderBottom: "1px solid #1a2235" }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: S.amber }}>
            SGFO · v2
          </p>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: S.text }}>Dashboard</h1>
        </div>
        <div
          className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full"
          style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#10b981" }} />
          Sistema operacional
        </div>
      </div>

      <div className="p-8">

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Módulos ativos", value: "3",         bg: S.amberBg, br: S.amberBorder, tc: S.amberLight },
            { label: "Budget total",   value: "R$ 30.000", bg: "#0d1829",  br: "#1a2e4a",    tc: "#60a5fa" },
            { label: "Ano fiscal",     value: "2026",      bg: "#170d29",  br: "#2a1845",    tc: "#a78bfa" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl px-5 py-4" style={{ background: k.bg, border: `1px solid ${k.br}` }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: k.tc }}>
                {k.label}
              </p>
              <p className="text-xl font-bold tracking-tight tabular-nums" style={{ color: k.tc }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* Module cards */}
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: S.dim }}>
          Módulos do sistema
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group rounded-xl p-6 flex flex-col gap-5 transition-all duration-150 hover:-translate-y-0.5"
              style={{ background: S.surface, border: `1px solid ${S.border}` }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: mod.accentBg, color: mod.accent, border: `1px solid ${mod.accentBorder}` }}
                >
                  {mod.icon}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3d5a82" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 transition-colors group-hover:stroke-slate-500">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: S.text }}>{mod.label}</h3>
                <p className="text-xs leading-relaxed" style={{ color: S.muted }}>{mod.description}</p>
              </div>
              <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: "14px" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: S.muted }}>
                  {mod.statLabel}
                </p>
                <p className="text-sm font-bold" style={{ color: mod.accent }}>{mod.stat}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer info */}
        <div
          className="rounded-xl px-6 py-4 flex items-center gap-3"
          style={{ background: S.surface, border: `1px solid ${S.border}` }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3d5a82" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm" style={{ color: S.muted }}>
            SGFO — gestão operacional de campo: orçamento, equipe e tarefas com foco em clareza.
          </p>
        </div>
      </div>
    </div>
  );
}
