'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
      style={{ background: '#0d1117', borderRight: '1px solid #1a2235' }}
    >
      {/* Logo */}
      <div className="h-[60px] flex items-center px-5" style={{ borderBottom: '1px solid #1a2235' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-[11px] tracking-tight shrink-0"
            style={{ background: '#d97706' }}
          >
            SF
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm tracking-tight" style={{ color: '#e2e8f5' }}>SGFO</span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: '#211c0e', color: '#f59e0b' }}
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
              className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
              style={{ color: '#3d5a82' }}
            >
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-100 ${
                      active ? '' : 'hover:bg-white/[0.03]'
                    }`}
                    style={
                      active
                        ? { background: 'rgba(245,158,11,0.08)', color: '#fbbf24' }
                        : { color: '#5b7aaa' }
                    }
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                        style={{ background: '#f59e0b' }}
                      />
                    )}
                    <span style={active ? { color: '#f59e0b' } : {}}>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid #1a2235' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ background: '#211c0e', color: '#f59e0b', border: '1px solid #3a2e0f' }}
          >
            OP
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: '#7a90b8' }}>Operador</p>
            <p className="text-[10px]" style={{ color: '#3d5a82' }}>Gestão de Campo · 2026</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
