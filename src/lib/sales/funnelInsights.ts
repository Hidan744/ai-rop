/**
 * Объяснение конкретного перехода воронки по клику на стрелку конверсии (страница «Воронка» и
 * компактная полоса воронки на «Сделках») — прогрессивное раскрытие деталей за цифрой, а не
 * общие слова. Переиспользует формулы конверсии/причин отказов/активности, уже посчитанные для
 * движка рекомендаций (recommendations.ts) и воронки (formulas.ts), вместо повторного счёта.
 */
import { buildLostReasonBreakdown, calculateConversionRate, calculatePeriodGrowthPct, dealReachedStage, type LostReasonBreakdownItem } from './formulas'
import { aggregateActivity, buildWeeklyStageConversionCohorts, weeklyWindows } from './recommendations'
import { FUNNEL_STAGE_LABELS, LOST_REASON_LABELS, type ActivityLogEntry, type Deal, type FunnelStage, type LostReason } from '@/types/sales'

export interface StageTransitionExplanation {
  from: FunnelStage
  to: FunnelStage
  /** Сколько сделок из вошедших в `from` на этой неделе дошли до `to`. */
  movedForwardCount: number
  /** Сколько вошедших в `from` на этой неделе до `to` не дошли (пока, в рамках недели). */
  droppedCount: number
  currentRatePct: number | null
  /** % изменения конверсии к предыдущей неделе — null, если недостаточно данных за одну из недель. */
  trendPct: number | null
  /** Топ-2 причины отказа среди сделок, потерянных именно после стадии `from`, не дойдя до `to`. */
  topLostReasons: LostReasonBreakdownItem[]
  /** Конверсия звонок → встреча за неделю — заполняется только для перехода в «Встреча назначена». */
  callToMeetingRatePct: number | null
  /** Готовое 1–3 предложения на русском для попапа. */
  sentence: string
}

function pluralizeDealsShort(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'сделок'
  if (mod10 === 1) return 'сделка'
  if (mod10 >= 2 && mod10 <= 4) return 'сделки'
  return 'сделок'
}

function buildSentence(input: {
  from: FunnelStage
  to: FunnelStage
  movedForwardCount: number
  droppedCount: number
  currentRatePct: number | null
  trendPct: number | null
  topLostReasons: LostReasonBreakdownItem[]
  callToMeetingRatePct: number | null
}): string {
  const { to, movedForwardCount, droppedCount, currentRatePct, trendPct, topLostReasons, callToMeetingRatePct } = input
  const totalEntered = movedForwardCount + droppedCount
  const sentences: string[] = []

  if (totalEntered > 0) {
    sentences.push(
      `На этой неделе на этап «${FUNNEL_STAGE_LABELS[to]}» перешли ${movedForwardCount} из ${totalEntered} ${pluralizeDealsShort(totalEntered)}` +
        `${currentRatePct !== null ? ` (${Math.round(currentRatePct)}%)` : ''}.`,
    )
  } else {
    sentences.push(`На этой неделе новых сделок на этом переходе не было — судить о динамике пока не по чему.`)
  }

  if (trendPct !== null && Math.abs(trendPct) >= 1) {
    sentences.push(`Это ${trendPct > 0 ? 'выше' : 'ниже'} прошлой недели на ${Math.abs(Math.round(trendPct))}%.`)
  }

  if (callToMeetingRatePct !== null) {
    sentences.push(`Конверсия звонок → встреча за эту неделю по отделу: ${Math.round(callToMeetingRatePct)}%.`)
  } else if (droppedCount > 0 && topLostReasons.length > 0) {
    const top = topLostReasons[0]
    const label = LOST_REASON_LABELS[top.reason as LostReason] ?? top.reason
    sentences.push(`Среди тех, кто не дошёл дальше и был закрыт как отказ, основная причина — «${label}» (${Math.round(top.sharePct)}%).`)
  }

  return sentences.join(' ')
}

/**
 * Строит объяснение конкретного перехода `from` → `to` на основе реальных данных за текущую и
 * предыдущую неделю. Причины отказов возвращаются с исходным (не подписанным) кодом reason —
 * подпись формируется в UI через LOST_REASON_LABELS, здесь только предложение уже готово со
 * значением reason «как есть» для внутреннего sentence (см. buildSentence).
 */
export function buildStageTransitionExplanation(input: {
  deals: Deal[]
  activityLog: ActivityLogEntry[]
  from: FunnelStage
  to: FunnelStage
  referenceISO: string
}): StageTransitionExplanation {
  const { deals, activityLog, from, to, referenceISO } = input

  const { current, previous } = buildWeeklyStageConversionCohorts(deals, referenceISO)
  const currentPair = current.find((c) => c.from === from && c.to === to) ?? null
  const previousPair = previous.find((c) => c.from === from && c.to === to) ?? null

  const trendPct =
    currentPair?.rate !== null && currentPair?.rate !== undefined && previousPair?.rate !== null && previousPair?.rate !== undefined
      ? calculatePeriodGrowthPct(currentPair.rate, previousPair.rate)
      : null

  const lostAfterFrom = deals.filter((d) => d.outcome === 'lost' && dealReachedStage(d, from) && !dealReachedStage(d, to))
  const topLostReasons = buildLostReasonBreakdown(lostAfterFrom).slice(0, 2)

  let callToMeetingRatePct: number | null = null
  if (to === 'meeting_scheduled') {
    const { currentWeekStart } = weeklyWindows(referenceISO)
    const { calls, meetings } = aggregateActivity(activityLog, null, currentWeekStart, referenceISO)
    callToMeetingRatePct = calculateConversionRate(meetings, calls)
  }

  const movedForwardCount = currentPair?.reachedTo ?? 0
  const droppedCount = currentPair ? currentPair.enteredFrom - currentPair.reachedTo : 0

  const sentence = buildSentence({
    from,
    to,
    movedForwardCount,
    droppedCount,
    currentRatePct: currentPair?.rate ?? null,
    trendPct,
    topLostReasons,
    callToMeetingRatePct,
  })

  return {
    from,
    to,
    movedForwardCount,
    droppedCount,
    currentRatePct: currentPair?.rate ?? null,
    trendPct,
    topLostReasons,
    callToMeetingRatePct,
    sentence,
  }
}
