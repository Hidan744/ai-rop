import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatPercent } from '@/lib/utils'

export type SalesHealthStatus = 'stable' | 'attention' | 'critical'

const STATUS_STYLES = {
  stable: { color: 'text-positive-500', bg: 'bg-positive-500/10', border: 'border-positive-500/30', Icon: CheckCircle2, label: 'Стабильно' },
  attention: { color: 'text-warning-500', bg: 'bg-warning-500/10', border: 'border-warning-500/30', Icon: AlertCircle, label: 'Требует внимания' },
  critical: { color: 'text-negative-500', bg: 'bg-negative-500/10', border: 'border-negative-500/30', Icon: XCircle, label: 'Критично' },
} as const

export function SalesHealthPanel({
  status,
  overallConversionPct,
  planFactPct,
  avgCycleLengthDays,
  criticalCount,
  warningCount,
}: {
  status: SalesHealthStatus
  overallConversionPct: number | null
  planFactPct: number | null
  avgCycleLengthDays: number | null
  criticalCount: number
  warningCount: number
}) {
  const style = STATUS_STYLES[status]
  const { Icon } = style

  return (
    <Card className={cn('border', style.border)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Здоровье отдела продаж</CardTitle>
        <span className="text-xs text-ink-500">Обновлено только что</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('flex size-10 items-center justify-center rounded-xl', style.bg)}>
            <Icon className={cn('size-5', style.color)} />
          </div>
          <div className={cn('text-lg font-semibold', style.color)}>{style.label}</div>
        </div>

        <div className="space-y-2.5">
          <Row label="Сквозная конверсия воронки" value={overallConversionPct !== null ? formatPercent(overallConversionPct) : '—'} />
          <Row label="План/факт месяца" value={planFactPct !== null ? formatPercent(planFactPct) : '—'} accent={planFactPct !== null && planFactPct < 80 ? 'warning' : undefined} />
          <Row label="Средний цикл сделки" value={avgCycleLengthDays !== null ? `${Math.round(avgCycleLengthDays)} дн.` : '—'} />
          <Row label="Активных рекомендаций" value={`${criticalCount + warningCount}`} accent={criticalCount > 0 ? 'negative' : warningCount > 0 ? 'warning' : undefined} />
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'negative' | 'warning' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-400">{label}</span>
      <span
        className={cn(
          'font-medium',
          accent === 'negative' && 'text-negative-500',
          accent === 'warning' && 'text-warning-500',
          !accent && 'text-ink-100',
        )}
      >
        {value}
      </span>
    </div>
  )
}
