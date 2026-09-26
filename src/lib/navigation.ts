import type { ComponentType } from 'react'
import { LayoutDashboard, Filter, Users, Handshake, TrendingUp, Settings } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/funnel', label: 'Воронка', icon: Filter },
  { to: '/app/managers', label: 'Менеджеры', icon: Users },
  { to: '/app/deals', label: 'Сделки', icon: Handshake },
  { to: '/app/forecast', label: 'Прогноз', icon: TrendingUp },
  { to: '/app/settings', label: 'Настройки', icon: Settings },
]
