import { Link, NavLink } from 'react-router-dom'
import { Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/icons/BrandMark'
import { NAV_ITEMS } from '@/lib/navigation'
import { useSalesStore } from '@/store/salesStore'

export function Sidebar() {
  const companyName = useSalesStore((s) => s.profile?.companyName)

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-950 h-screen sticky top-0 print:hidden">
      <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b border-ink-800 hover:bg-ink-900 transition-colors">
        <div className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-aurora-amber-soft via-aurora-violet to-aurora-blue shrink-0">
          <BrandMark className="size-4 text-ink-950" />
        </div>
        <div className="text-sm font-semibold text-ink-50 truncate">AI РОП</div>
      </Link>

      {companyName && (
        <div className="px-5 pt-3 text-xs text-ink-500 truncate" title={companyName}>
          {companyName}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-brand-500/15 text-brand-400' : 'text-ink-400 hover:text-ink-100 hover:bg-ink-900',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-ink-800">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-400 hover:text-ink-100 hover:bg-ink-900 transition-colors"
        >
          <Home className="size-4 shrink-0" />
          На главную
        </Link>
      </div>
    </aside>
  )
}
