import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { useSalesFacts } from '@/hooks/useSalesFacts'
import { useSalesStore } from '@/store/salesStore'
import { CATEGORICAL, STATUS } from '@/lib/chartColors'
import { buildStageTransitionExplanation } from '@/lib/sales/funnelInsights'
import { StageTransitionDisclosure } from '@/features/funnel/StageTransitionDisclosure'
import { FUNNEL_STAGE_LABELS, OPEN_FUNNEL_STAGES, type FunnelStage } from '@/types/sales'

// Фиксированный порядок слотов категориальной палитры — по позиции стадии в воронке,
// НЕ по величине показателя (см. dataviz skill).
const STAGE_COLORS = [CATEGORICAL.slot1, CATEGORICAL.slot2, CATEGORICAL.slot3, CATEGORICAL.slot4, CATEGORICAL.slot5]

function conversionStatusColor(rate: number | null): string {
  if (rate === null) return STATUS.warning
  if (rate >= 50) return STATUS.good
  if (rate >= 30) return STATUS.warning
  if (rate >= 15) return STATUS.serious
  return STATUS.critical
}

const FUNNEL_PATH: FunnelStage[] = [...OPEN_FUNNEL_STAGES, 'won']

export function FunnelPage() {
  const referenceISO = new Date().toISOString()
  const facts = useSalesFacts(referenceISO)
  const deals = useSalesStore((s) => s.deals)
  const activityLog = useSalesStore((s) => s.activityLog)
  const maxCount = Math.max(1, ...OPEN_FUNNEL_STAGES.map((s) => facts.stageCounts[s] ?? 0))

  const explanations = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildStageTransitionExplanation>>()
    for (let i = 0; i < FUNNEL_PATH.length - 1; i++) {
      const from = FUNNEL_PATH[i]
      const to = FUNNEL_PATH[i + 1]
      map.set(`${from}::${to}`, buildStageTransitionExplanation({ deals, activityLog, from, to, referenceISO }))
    }
    return map
  }, [deals, activityLog, referenceISO])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-50">Воронка продаж</h1>
        <p className="text-sm text-ink-500 mt-1">Открытые сделки по стадиям и конверсия между соседними этапами</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Стадии воронки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {OPEN_FUNNEL_STAGES.map((stage, i) => {
            const count = facts.stageCounts[stage] ?? 0
            const value = facts.stageValues[stage] ?? 0
            const widthPct = Math.max(6, (count / maxCount) * 100)
            const conversion = facts.adjacentConversions[i]
            return (
              <div key={stage}>
                <div className="flex items-center gap-4 py-2.5">
                  <div className="w-40 shrink-0 text-sm text-ink-200">{FUNNEL_STAGE_LABELS[stage]}</div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="h-9 rounded-lg flex items-center px-3 text-xs font-medium text-ink-950 transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
                    >
                      {count} сделок
                    </div>
                  </div>
                  <div className="w-32 shrink-0 text-right text-sm text-ink-300">{formatCurrency(value)}</div>
                </div>
                {conversion && i < OPEN_FUNNEL_STAGES.length - 1 && (
                  <div className="pl-44 py-1">
                    <StageTransitionDisclosure
                      explanation={explanations.get(`${conversion.from}::${conversion.to}`)!}
                      color={conversionStatusColor(conversion.rate)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Конверсия между стадиями</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {facts.adjacentConversions.map((c) => (
            <div key={`${c.from}-${c.to}`} className="rounded-xl border border-ink-800 p-4">
              <div className="text-xs text-ink-500 mb-1.5">
                {FUNNEL_STAGE_LABELS[c.from]} → {FUNNEL_STAGE_LABELS[c.to]}
              </div>
              <div
                className={cn('text-xl font-display font-semibold')}
                style={{ color: conversionStatusColor(c.rate) }}
              >
                {c.rate !== null ? formatPercent(c.rate) : '—'}
              </div>
              <div className="text-xs text-ink-500 mt-1">
                {c.reachedTo} из {c.enteredFrom} сделок
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {(() => {
        const worst = [...facts.adjacentConversions]
          .filter((c) => c.rate !== null)
          .sort((a, b) => (a.rate as number) - (b.rate as number))[0]
        if (!worst || worst.rate === null || worst.rate >= 30) return null
        return (
          <Card className="p-5 border-warning-500/30 bg-warning-500/10">
            <div className="text-sm text-ink-100">
              Самый слабый переход воронки — <strong>{FUNNEL_STAGE_LABELS[worst.from]} → {FUNNEL_STAGE_LABELS[worst.to]}</strong>{' '}
              ({formatPercent(worst.rate)}). Именно здесь теряется больше всего сделок — стоит разобрать причины на этом этапе в первую очередь.
            </div>
          </Card>
        )
      })()}
    </div>
  )
}
