import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import { useSalesFacts } from '@/hooks/useSalesFacts'
import { useSalesStore } from '@/store/salesStore'
import { STATUS } from '@/lib/chartColors'
import { buildStageTransitionExplanation } from '@/lib/sales/funnelInsights'
import { FUNNEL_STAGE_LABELS, OPEN_FUNNEL_STAGES } from '@/types/sales'

function conversionStatusColor(rate: number | null): string {
  if (rate === null) return STATUS.warning
  if (rate >= 50) return STATUS.good
  if (rate >= 30) return STATUS.warning
  if (rate >= 15) return STATUS.serious
  return STATUS.critical
}

/**
 * Условённая версия воронки для страницы «Сделки» — те же данные, что и на полной странице
 * «Воронка» (stage → count → sum → конверсия → среднее время в стадии), в одну строку. Стрелки
 * конверсии кликабельны так же, как на полной странице — раскрывают объяснение перехода ниже
 * полосы (один открытый переход за раз, чтобы не загромождать компактный вид).
 */
export function CompactFunnelStrip() {
  const referenceISO = new Date().toISOString()
  const facts = useSalesFacts(referenceISO)
  const deals = useSalesStore((s) => s.deals)
  const activityLog = useSalesStore((s) => s.activityLog)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const explanations = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildStageTransitionExplanation>>()
    const path = [...OPEN_FUNNEL_STAGES, 'won' as const]
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]
      map.set(`${from}::${to}`, buildStageTransitionExplanation({ deals, activityLog, from, to, referenceISO }))
    }
    return map
  }, [deals, activityLog, referenceISO])

  const selected = selectedKey ? explanations.get(selectedKey) : null

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold text-ink-200 mb-3">Воронка (кратко)</div>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
        {OPEN_FUNNEL_STAGES.map((stage, i) => {
          const count = facts.stageCounts[stage] ?? 0
          const value = facts.stageValues[stage] ?? 0
          const avgDays = facts.stageMedianDwellDays[stage]
          const conversion = facts.adjacentConversions[i]
          const key = conversion ? `${conversion.from}::${conversion.to}` : null
          return (
            <div key={stage} className="flex items-center shrink-0">
              <div className="rounded-lg border border-ink-800 px-3 py-2 min-w-36">
                <div className="text-[11px] text-ink-500 truncate">{FUNNEL_STAGE_LABELS[stage]}</div>
                <div className="text-sm font-semibold text-ink-50 whitespace-nowrap">
                  {count} · {formatCurrency(value)}
                </div>
                <div className="text-[10px] text-ink-500">{avgDays !== undefined ? `~${Math.round(avgDays)} дн. в стадии` : '—'}</div>
              </div>
              {conversion && i < OPEN_FUNNEL_STAGES.length - 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedKey((k) => (k === key ? null : key))}
                  className="mx-1.5 shrink-0 text-xs font-medium rounded-full px-2.5 py-1 hover:brightness-110 transition"
                  style={{ color: conversionStatusColor(conversion.rate), backgroundColor: `${conversionStatusColor(conversion.rate)}1a` }}
                  aria-expanded={selectedKey === key}
                >
                  → {conversion.rate !== null ? formatPercent(conversion.rate) : '—'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {selected && (
        <div className={cn('mt-3 rounded-xl border border-ink-800 bg-ink-900/70 px-3.5 py-3 text-xs text-ink-200 leading-relaxed animate-in fade-in-0')}>
          {selected.sentence}
        </div>
      )}
    </Card>
  )
}
