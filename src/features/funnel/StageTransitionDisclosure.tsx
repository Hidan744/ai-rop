import { useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { formatPercent } from '@/lib/utils'
import type { StageTransitionExplanation } from '@/lib/sales/funnelInsights'

/**
 * Стрелка конверсии между стадиями — по умолчанию выглядит ровно как раньше (просто цифра),
 * но по клику раскрывает 1–3 предложения о том, что реально стоит за этим числом (прогрессивное
 * раскрытие — не меняет разметку страницы, пока не открыта).
 */
export function StageTransitionDisclosure({ explanation, color }: { explanation: StageTransitionExplanation; color: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 py-0.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      >
        <ArrowDown className="size-3.5 text-ink-600 shrink-0" />
        <span
          className="text-xs font-medium rounded-full px-2 py-0.5 hover:brightness-110 transition"
          style={{ color, backgroundColor: `${color}1a` }}
        >
          {explanation.currentRatePct !== null ? formatPercent(explanation.currentRatePct) : '—'} конверсия
        </span>
      </button>
      {open && (
        <div className="mt-1.5 mb-1 max-w-xl rounded-xl border border-ink-800 bg-ink-900/80 px-3.5 py-3 text-xs text-ink-200 leading-relaxed animate-in fade-in-0">
          {explanation.sentence}
        </div>
      )}
    </div>
  )
}
