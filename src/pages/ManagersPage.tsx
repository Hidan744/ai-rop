import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatPercent } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import {
  calculateAverageCycleLengthDays,
  calculateOverallFunnelConversion,
  calculatePeriodGrowthPct,
  flagStuckDeals,
} from '@/lib/sales/formulas'

const PERIOD_DAYS = 45

export function ManagersPage() {
  const deals = useSalesStore((s) => s.deals)
  const managers = useSalesStore((s) => s.managers)
  const referenceISO = new Date().toISOString()
  const now = new Date(referenceISO).getTime()
  const periodMs = PERIOD_DAYS * 24 * 60 * 60 * 1000

  const rows = managers.map((manager) => {
    const managerDeals = deals.filter((d) => d.managerId === manager.id)
    const currentPeriod = managerDeals.filter((d) => now - new Date(d.createdAt).getTime() <= periodMs)
    const previousPeriod = managerDeals.filter((d) => {
      const age = now - new Date(d.createdAt).getTime()
      return age > periodMs && age <= periodMs * 2
    })

    const conversion = calculateOverallFunnelConversion(managerDeals)
    const currentConversion = calculateOverallFunnelConversion(currentPeriod)
    const previousConversion = calculateOverallFunnelConversion(previousPeriod)
    const trendPct =
      currentConversion !== null && previousConversion !== null ? calculatePeriodGrowthPct(currentConversion, previousConversion) : null

    const avgCycleLengthDays = calculateAverageCycleLengthDays(managerDeals)
    const stuckCount = flagStuckDeals(managerDeals, referenceISO).length
    const openCount = managerDeals.filter((d) => d.outcome === 'open').length
    const wonCount = managerDeals.filter((d) => d.outcome === 'won').length
    const lostCount = managerDeals.filter((d) => d.outcome === 'lost').length

    return {
      manager,
      dealCount: managerDeals.length,
      openCount,
      wonCount,
      lostCount,
      conversion,
      trendPct,
      avgCycleLengthDays,
      stuckCount,
    }
  })

  rows.sort((a, b) => b.stuckCount - a.stuckCount || (b.conversion ?? 0) - (a.conversion ?? 0))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-50">Менеджеры</h1>
        <p className="text-sm text-ink-500 mt-1">Конверсия, цикл сделки и зависшие сделки по каждому продавцу</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сводка по отделу</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500 border-b border-ink-800">
                <th className="py-2.5 pr-4 font-medium">Менеджер</th>
                <th className="py-2.5 pr-4 font-medium text-right">Сделок</th>
                <th className="py-2.5 pr-4 font-medium text-right">Открыто</th>
                <th className="py-2.5 pr-4 font-medium text-right">Выиграно</th>
                <th className="py-2.5 pr-4 font-medium text-right">Отказ</th>
                <th className="py-2.5 pr-4 font-medium text-right">Конверсия</th>
                <th className="py-2.5 pr-4 font-medium text-right">Тренд</th>
                <th className="py-2.5 pr-4 font-medium text-right">Ср. цикл</th>
                <th className="py-2.5 font-medium text-right">Зависших</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ manager, dealCount, openCount, wonCount, lostCount, conversion, trendPct, avgCycleLengthDays, stuckCount }) => (
                <tr key={manager.id} className="border-b border-ink-800/60 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-ink-800 text-xs font-medium text-ink-200 shrink-0">
                        {manager.initials}
                      </div>
                      <span className="text-ink-100">{manager.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right text-ink-200">{dealCount}</td>
                  <td className="py-3 pr-4 text-right text-ink-400">{openCount}</td>
                  <td className="py-3 pr-4 text-right text-positive-500">{wonCount}</td>
                  <td className="py-3 pr-4 text-right text-negative-500">{lostCount}</td>
                  <td className="py-3 pr-4 text-right text-ink-100 font-medium">{conversion !== null ? formatPercent(conversion) : '—'}</td>
                  <td className="py-3 pr-4 text-right">
                    <TrendBadge value={trendPct} />
                  </td>
                  <td className="py-3 pr-4 text-right text-ink-200">
                    {avgCycleLengthDays !== null ? `${Math.round(avgCycleLengthDays)} дн.` : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn('font-medium', stuckCount > 0 ? 'text-negative-500' : 'text-ink-400')}>{stuckCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-500 inline-flex items-center gap-1 justify-end"><Minus className="size-3.5" />—</span>
  if (Math.abs(value) < 1) return <span className="text-ink-500 inline-flex items-center gap-1 justify-end"><Minus className="size-3.5" />0%</span>
  const isUp = value > 0
  return (
    <span className={cn('inline-flex items-center gap-1 justify-end font-medium', isUp ? 'text-positive-500' : 'text-negative-500')}>
      {isUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {Math.abs(Math.round(value))}%
    </span>
  )
}
