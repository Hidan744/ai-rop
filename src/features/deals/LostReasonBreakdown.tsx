import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORICAL } from '@/lib/chartColors'
import { buildLostReasonBreakdown } from '@/lib/sales/formulas'
import { formatPercent } from '@/lib/utils'
import { LOST_REASON_LABELS, type Deal, type LostReason } from '@/types/sales'

// Фиксированный порядок причин по слоту палитры — НЕ пересортировывается по величине доли
// (см. dataviz skill: категориальный цвет закреплён за категорией, а не за рангом).
const REASON_ORDER: LostReason[] = ['price', 'chose_competitor', 'no_budget', 'not_relevant', 'timing', 'no_response', 'other']
const REASON_COLOR: Record<LostReason, string> = {
  price: CATEGORICAL.slot1,
  chose_competitor: CATEGORICAL.slot2,
  no_budget: CATEGORICAL.slot3,
  not_relevant: CATEGORICAL.slot4,
  timing: CATEGORICAL.slot5,
  no_response: CATEGORICAL.slot6,
  other: CATEGORICAL.slot7,
}

/** Бар-лист причин отказов — переданные `deals` уже отфильтрованы вызывающей страницей (обычно за последний месяц). */
export function LostReasonBreakdown({ deals, title = 'Причины потерь за месяц' }: { deals: Deal[]; title?: string }) {
  const breakdown = buildLostReasonBreakdown(deals)
  if (breakdown.length === 0) return null
  const byReason = new Map(breakdown.map((b) => [b.reason as LostReason, b]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {REASON_ORDER.filter((r) => byReason.has(r)).map((reason) => {
          const item = byReason.get(reason)!
          return (
            <div key={reason} className="flex items-center gap-3">
              <span className="w-36 text-xs text-ink-300 shrink-0 truncate">{LOST_REASON_LABELS[reason]}</span>
              <div className="flex-1 h-2 rounded-full bg-ink-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, item.sharePct)}%`, backgroundColor: REASON_COLOR[reason] }} />
              </div>
              <span className="w-10 text-right text-xs text-ink-200 font-medium">{formatPercent(item.sharePct, 0)}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
