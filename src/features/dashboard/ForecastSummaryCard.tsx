import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatPercent } from '@/lib/utils'

/**
 * Единый блок «План / Закрыто / Pipeline / Взвешенный pipeline / Прогноз» — один и тот же
 * компонент и на Dashboard, и вверху страницы «Сделки», чтобы прогноз месяца был виден без
 * перехода на страницу «Прогноз» (просьба продукта), без повторного счёта формул.
 */
export function ForecastSummaryCard({
  plan,
  closedValue,
  openPipelineValue,
  weightedPipelineValue,
  forecast,
  title = 'Прогноз месяца',
}: {
  plan: number
  closedValue: number
  openPipelineValue: number
  weightedPipelineValue: number
  forecast: number
  title?: string
}) {
  const closedPct = plan > 0 ? (closedValue / plan) * 100 : null

  return (
    <Card className="p-6">
      <CardHeader className="p-0 mb-4">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-3 text-sm">
        <Row label="План" value={formatCurrency(plan)} />
        <Row label="Закрыто" value={formatCurrency(closedValue)} />
        <Row label="Pipeline (открытые)" value={formatCurrency(openPipelineValue)} />
        <Row label="Взвешенный pipeline" value={formatCurrency(weightedPipelineValue)} />
        <Row label="Прогноз" value={formatCurrency(forecast)} strong />

        <div className="pt-2">
          <div className="flex items-center justify-between mb-1.5 text-xs text-ink-500">
            <span>Закрыто</span>
            <span className="text-ink-200 font-medium">{closedPct !== null ? formatPercent(closedPct, 0) : '—'}</span>
          </div>
          <Progress value={closedPct ?? 0} />
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex items-center justify-between pt-2 border-t border-ink-800' : 'flex items-center justify-between'}>
      <span className={strong ? 'text-ink-300' : 'text-ink-400'}>{label}</span>
      <span className={strong ? 'text-brand-400 font-semibold' : 'text-ink-100 font-medium'}>{value}</span>
    </div>
  )
}
