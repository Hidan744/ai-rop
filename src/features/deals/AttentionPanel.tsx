import { AlertOctagon, CheckCircle2, Clock3, TimerOff, Wallet, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { STATUS } from '@/lib/chartColors'
import type { AttentionSummary } from '@/lib/sales/dealAttention'

/**
 * «🔥 Требуют внимания» — сводка проблемных сделок прямо здесь, без похода в фильтры. Цвета
 * взяты из STATUS (chartColors.ts) и используются только как индикатор состояния (иконка/точка
 * счётчика), а не как категориальный цвет — по правилам dataviz skill.
 */
export function AttentionPanel({ summary }: { summary: AttentionSummary }) {
  const items: Array<{ icon: React.ReactNode; label: string; count: number; status: 'critical' | 'warning' | 'good' }> = [
    { icon: <TimerOff className="size-4" />, label: 'без активности > 5 дней', count: summary.noActivityCount, status: 'critical' },
    { icon: <XCircle className="size-4" />, label: 'просрочили следующий шаг', count: summary.overdueNextStepCount, status: 'critical' },
    { icon: <Clock3 className="size-4" />, label: 'на стадии дольше 30 дней', count: summary.stageOverLimitCount, status: 'warning' },
    { icon: <AlertOctagon className="size-4" />, label: 'без назначенного следующего шага', count: summary.noNextStepCount, status: 'warning' },
    { icon: <CheckCircle2 className="size-4" />, label: 'готовы к закрытию', count: summary.readyToCloseCount, status: 'good' },
  ]

  const statusColor: Record<'critical' | 'warning' | 'good', string> = {
    critical: STATUS.critical,
    warning: STATUS.warning,
    good: STATUS.good,
  }

  return (
    <Card className="p-5">
      <div className="text-sm font-semibold text-ink-200 mb-4 flex items-center gap-1.5">🔥 Требуют внимания</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl border border-ink-800 px-3.5 py-3">
            <span className="shrink-0" style={{ color: statusColor[item.status] }}>
              {item.icon}
            </span>
            <div className="min-w-0">
              <div className="text-lg font-display font-semibold text-ink-50 leading-none">{item.count}</div>
              <div className="text-[11px] text-ink-500 mt-1 leading-snug">{item.label}</div>
            </div>
          </div>
        ))}
        <div className={cn('flex items-center gap-3 rounded-xl border border-ink-800 px-3.5 py-3')}>
          <Wallet className="size-4 text-ink-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-display font-semibold text-ink-50 leading-none">{formatCurrency(summary.weekPotentialValue)}</div>
            <div className="text-[11px] text-ink-500 mt-1 leading-snug">потенциал на этой неделе (взвешенно)</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
