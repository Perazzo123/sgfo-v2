'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ROUTE_ACCENT: Record<string, string> = {
  '/':         '#ffb700',
  '/projects': '#0ea5e9',
  '/costs':    '#06d6f5',
  '/people':   '#00ff88',
  '/backlog':  '#a855f7',
}

const navGroups = [
  {
    label: 'Principal',
    items: [
      {
        label: 'Dashboard',
        href: '/',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
          </svg>
        ),
      },
      {
        label: 'Projetos',
        href: '/projects',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="7" height="6" rx="1.5" />
            <rect x="14" y="4" width="7" height="6" rx="1.5" />
            <rect x="3" y="14" width="7" height="6" rx="1.5" />
            <line x1="16" y1="14" x2="20" y2="14" />
            <line x1="16" y1="17" x2="20" y2="17" />
            <line x1="16" y1="20" x2="20" y2="20" />
          </svg>
        ),
      },
      {
        label: 'Custos',
        href: '/costs',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Operações',
    items: [
      {
        label: 'Pessoas',
        href: '/people',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        label: 'Backlog',
        href: '/backlog',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        ),
      },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-[220px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{
        background: '#020810',
        borderRight: '1px solid rgba(6,214,245,0.1)',
        boxShadow: '2px 0 30px rgba(0,0,0,0.7)',
      }}
    >
      {/* Logo */}
      <div className="h-[60px] flex items-center px-5" style={{ borderBottom: '1px solid rgba(6,214,245,0.08)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-[11px] tracking-tight shrink-0"
            style={{
              background: 'rgba(255,183,0,0.1)',
              border: '1px solid rgba(255,183,0,0.3)',
              color: '#ffb700',
              boxShadow: '0 0 14px rgba(255,183,0,0.2)',
            }}
          >
            SF
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-bold text-sm tracking-tight"
              style={{ color: '#c8e8ff', textShadow: '0 0 20px rgba(6,214,245,0.3)' }}
            >
              SGFO
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(255,183,0,0.08)',
                color: '#ffb700',
                border: '1px solid rgba(255,183,0,0.2)',
              }}
            >
              v2
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-5 px-3 overflow-y-auto space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p
              className="text-[9px] font-bold uppercase tracking-[0.2em] px-3 mb-2"
              style={{ color: '#1a3050' }}
            >
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href
                const accent = ROUTE_ACCENT[item.href] ?? '#ffb700'
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
                    style={
                      active
                        ? {
                            background: `${accent}0d`,
                            color: accent,
                            boxShadow: `inset 0 0 20px ${accent}06, 0 0 1px ${accent}30`,
                          }
                        : { color: '#2a5070' }
                    }
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                        style={{
                          background: accent,
                          boxShadow: `0 0 10px ${accent}, 0 0 20px ${accent}88`,
                        }}
                      />
                    )}
                    <span
                      style={
                        active
                          ? { color: accent, filter: `drop-shadow(0 0 5px ${accent}99)` }
                          : {}
                      }
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(6,214,245,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{
              background: 'rgba(255,183,0,0.08)',
              color: '#ffb700',
              border: '1px solid rgba(255,183,0,0.2)',
            }}
          >
            OP
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: '#5a8ab0' }}>Operador</p>
            <p className="text-[10px]" style={{ color: '#1a3050' }}>Gestão de Campo · 2026</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
