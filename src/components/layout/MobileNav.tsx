import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Home, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandMark } from '@/components/icons/BrandMark'
import { NAV_ITEMS } from '@/lib/navigation'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden print:hidden">
      <div className="flex items-center justify-between h-14 px-4 border-b border-ink-800 bg-ink-950">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-linear-to-br from-aurora-amber-soft via-aurora-violet to-aurora-blue shrink-0">
            <BrandMark className="size-3.5 text-ink-950" />
          </div>
          <span className="text-sm font-semibold">AI РОП</span>
        </Link>
        <button onClick={() => setOpen(true)} aria-label="Открыть меню" className="text-ink-300">
          <Menu className="size-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink-950 flex flex-col">
          <div className="flex items-center justify-between h-14 px-4 border-b border-ink-800 shrink-0">
            <span className="text-sm font-semibold">Меню</span>
            <button onClick={() => setOpen(false)} aria-label="Закрыть меню" className="text-ink-300">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn('block rounded-xl px-4 py-3 text-sm font-medium', isActive ? 'bg-brand-500/15 text-brand-400' : 'text-ink-300')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="px-3 pt-3 pb-3 border-t border-ink-800">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-ink-300"
              >
                <Home className="size-4 shrink-0" />
                На главную
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
