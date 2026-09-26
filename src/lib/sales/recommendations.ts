/**
 * Правило-based движок рекомендаций — детерминированный и объяснимый (НЕ вызов LLM в этой
 * фазе), по аналогии с src/lib/marketing/recommendations.ts у AI CMO и
 * buildInventoryDigest/diagnostics у Business Financial OS.
 *
 * Архитектура нарочно повторяет тот же приём: сначала чистыми функциями считаются факты
 * (buildManagerStageFacts/buildConversionFacts/...), и только потом факты превращаются в
 * предложения на естественном языке шаблонными функциями. Это оставляет возможность в
 * будущей фазе заменить buildRecommendations на вызов реальной LLM, передав ей те же факты,
 * без переписывания остального кода.
 */
import type { ActivityLogEntry, Deal, FunnelStage, Manager } from '@/types/sales'
import { FUNNEL_STAGE_LABELS, LOST_REASON_LABELS } from '@/types/sales'
import { formatCurrency } from '@/lib/utils'
import {
  buildLostReasonBreakdown,
  calculateAdjacentStageConversions,
  calculateAverageCycleLengthDays,
  calculateConversionRate,
  calculatePeriodGrowthPct,
  flagStuckDeals,
  type StuckDealFlag,
} from './formulas'

/** Сделка считается «крупной» от этой суммы, ₽ — порог, по которому зависшие сделки попадают в рекомендацию. */
export const BIG_DEAL_VALUE_THRESHOLD = 400_000
/** Минимум зависших крупных сделок у менеджера в стадии, чтобы сгенерировать рекомендацию. */
export const STUCK_BIG_DEALS_MIN_COUNT = 2
/** Падение конверсии между стадиями за неделю, начиная с которого — предупреждение. */
export const CONVERSION_DROP_WARNING_PCT = 15
/** Падение конверсии, начиная с которого — критическая рекомендация. */
export const CONVERSION_DROP_CRITICAL_PCT = 25
/** Доля отказов по одной причине, начиная с которой она считается «основной». */
export const LOST_REASON_SHARE_WARNING_PCT = 30
/** Рост среднего цикла сделки к прошлому периоду, начиная с которого — предупреждение. */
export const CYCLE_LENGTH_GROWTH_WARNING_PCT = 20

export type RecommendationSeverity = 'critical' | 'warning' | 'info'
export type RecommendationType = 'stuck_deals' | 'conversion_drop' | 'lost_reason' | 'cycle_length' | 'opportunity'

export interface Recommendation {
  id: string
  type: RecommendationType
  severity: RecommendationSeverity
  managerId: string | null
  managerName: string | null
  stage: FunnelStage | null
  dealCount: number | null
  totalValue: number | null
  metricChangePct: number | null
  sentence: string
}

export interface ManagerStuckFact {
  managerId: string
  managerName: string
  stage: FunnelStage
  bigDealFlags: StuckDealFlag[]
  totalValue: number
}

/** Группирует зависшие сделки по менеджеру и стадии — только «крупные» сделки формируют факт. */
export function buildManagerStuckFacts(deals: Deal[], managers: Manager[], referenceISO: string): ManagerStuckFact[] {
  const managerById = new Map(managers.map((m) => [m.id, m]))
  const stuck = flagStuckDeals(deals, referenceISO)
  const key = (managerId: string, stage: FunnelStage) => `${managerId}::${stage}`
  const groups = new Map<string, StuckDealFlag[]>()
  for (const flag of stuck) {
    if (flag.deal.value < BIG_DEAL_VALUE_THRESHOLD) continue
    const k = key(flag.deal.managerId, flag.deal.stage)
    const arr = groups.get(k) ?? []
    arr.push(flag)
    groups.set(k, arr)
  }
  const facts: ManagerStuckFact[] = []
  for (const [k, flags] of groups) {
    const [managerId, stage] = k.split('::') as [string, FunnelStage]
    if (flags.length < STUCK_BIG_DEALS_MIN_COUNT) continue
    facts.push({
      managerId,
      managerName: managerById.get(managerId)?.name ?? 'Неизвестный менеджер',
      stage,
      bigDealFlags: flags,
      totalValue: flags.reduce((sum, f) => sum + f.deal.value, 0),
    })
  }
  return facts.sort((a, b) => b.totalValue - a.totalValue)
}

export interface ManagerCallMeetingConversionFact {
  managerId: string
  managerName: string
  currentRate: number | null
  previousRate: number | null
  changePct: number | null
}

/** Агрегирует звонки/встречи менеджера за окно дней, начиная с startISO (исключая endISO). */
function aggregateActivity(log: ActivityLogEntry[], managerId: string, startISO: string, endISO: string) {
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()
  let calls = 0
  let meetings = 0
  for (const entry of log) {
    if (entry.managerId !== managerId) continue
    const t = new Date(entry.date).getTime()
    if (t >= start && t < end) {
      calls += entry.calls
      meetings += entry.meetings
    }
  }
  return { calls, meetings }
}

/**
 * Конверсия «звонок → встреча» за последнюю неделю против предыдущей — по каждому менеджеру.
 * referenceISO — конец текущей (последней) недели наблюдения.
 */
export function buildManagerCallMeetingConversionFacts(
  activityLog: ActivityLogEntry[],
  managers: Manager[],
  referenceISO: string,
): ManagerCallMeetingConversionFact[] {
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const currentStart = new Date(new Date(referenceISO).getTime() - weekMs).toISOString()
  const previousStart = new Date(new Date(referenceISO).getTime() - 2 * weekMs).toISOString()

  return managers.map((manager) => {
    const current = aggregateActivity(activityLog, manager.id, currentStart, referenceISO)
    const previous = aggregateActivity(activityLog, manager.id, previousStart, currentStart)
    const currentRate = calculateConversionRate(current.meetings, current.calls)
    const previousRate = calculateConversionRate(previous.meetings, previous.calls)
    const changePct =
      currentRate !== null && previousRate !== null ? calculatePeriodGrowthPct(currentRate, previousRate) : null
    return { managerId: manager.id, managerName: manager.name, currentRate, previousRate, changePct }
  })
}

function pluralizeDeals(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'сделкам'
  if (mod10 === 1) return 'сделке'
  if (mod10 >= 2 && mod10 <= 4) return 'сделкам'
  return 'сделкам'
}

/** Шаблон предложения для комбинированной рекомендации — точная структура примера из брифа продукта. */
export function buildStuckPlusConversionDropSentence(input: {
  managerName: string
  stageLabel: string
  dealCount: number
  conversionDropPct: number
}): string {
  return `Менеджер ${input.managerName} завис на этапе ${input.stageLabel} по ${input.dealCount} крупным ${pluralizeDeals(input.dealCount)}. Конверсия из звонка во встречу упала на ${Math.round(input.conversionDropPct)}% за неделю. Обратите внимание на его скрипт.`
}

export function buildStuckOnlySentence(input: { managerName: string; stageLabel: string; dealCount: number; totalValue: number }): string {
  return `Менеджер ${input.managerName} завис на этапе ${input.stageLabel} по ${input.dealCount} крупным ${pluralizeDeals(input.dealCount)} на общую сумму ${formatCurrency(input.totalValue)}. Стоит выяснить, что мешает довести их до следующего этапа.`
}

export function buildConversionDropSentence(input: { fromLabel: string; toLabel: string; dropPct: number }): string {
  return `Конверсия из «${input.fromLabel}» в «${input.toLabel}» упала на ${Math.round(input.dropPct)}% за неделю. Проверьте, что изменилось в работе с этим этапом.`
}

export function buildLostReasonSentence(input: { reasonLabel: string; sharePct: number }): string {
  return `Основная причина отказов — «${input.reasonLabel}»: ${Math.round(input.sharePct)}% всех отказов за период. Разберите возражение в скриптах и материалах для менеджеров.`
}

export function buildCycleLengthSentence(input: { currentDays: number; growthPct: number }): string {
  return `Средний цикл сделки вырос до ${Math.round(input.currentDays)} дней (+${Math.round(input.growthPct)}% к прошлому периоду). Сделки закрываются медленнее — стоит проверить, где воронка тормозит.`
}

export function buildOpportunitySentence(input: { managerName: string; conversionPct: number; portfolioAvgPct: number }): string {
  const diff = Math.round(input.conversionPct - input.portfolioAvgPct)
  return `Менеджер ${input.managerName} показывает конверсию звонок → встреча на ${diff} п.п. выше среднего по отделу. Стоит изучить и растиражировать его подход.`
}

/**
 * Строит ранжированный список рекомендаций: критичные — первыми, затем по масштабу влияния
 * (сумма затронутых сделок). Детерминированный набор правил, без обращения к LLM — см.
 * комментарий в шапке файла.
 */
export function buildRecommendations(
  deals: Deal[],
  managers: Manager[],
  activityLog: ActivityLogEntry[],
  referenceISO: string = new Date().toISOString(),
): Recommendation[] {
  const recommendations: Recommendation[] = []
  const usedManagerIds = new Set<string>()

  const stuckFacts = buildManagerStuckFacts(deals, managers, referenceISO)
  const conversionFacts = buildManagerCallMeetingConversionFacts(activityLog, managers, referenceISO)
  const conversionByManager = new Map(conversionFacts.map((f) => [f.managerId, f]))

  for (const fact of stuckFacts) {
    const conversionFact = conversionByManager.get(fact.managerId)
    const hasConversionDrop =
      conversionFact?.changePct !== null &&
      conversionFact?.changePct !== undefined &&
      conversionFact.changePct <= -CONVERSION_DROP_WARNING_PCT

    const stageLabel = FUNNEL_STAGE_LABELS[fact.stage]
    const severity: RecommendationSeverity =
      fact.bigDealFlags.length >= STUCK_BIG_DEALS_MIN_COUNT + 1 ||
      (hasConversionDrop && (conversionFact?.changePct as number) <= -CONVERSION_DROP_CRITICAL_PCT)
        ? 'critical'
        : 'warning'

    if (hasConversionDrop) {
      usedManagerIds.add(fact.managerId)
      recommendations.push({
        id: `stuck_conv_${fact.managerId}_${fact.stage}`,
        type: 'stuck_deals',
        severity,
        managerId: fact.managerId,
        managerName: fact.managerName,
        stage: fact.stage,
        dealCount: fact.bigDealFlags.length,
        totalValue: fact.totalValue,
        metricChangePct: conversionFact?.changePct ?? null,
        sentence: buildStuckPlusConversionDropSentence({
          managerName: fact.managerName,
          stageLabel,
          dealCount: fact.bigDealFlags.length,
          conversionDropPct: Math.abs(conversionFact?.changePct as number),
        }),
      })
    } else {
      recommendations.push({
        id: `stuck_${fact.managerId}_${fact.stage}`,
        type: 'stuck_deals',
        severity,
        managerId: fact.managerId,
        managerName: fact.managerName,
        stage: fact.stage,
        dealCount: fact.bigDealFlags.length,
        totalValue: fact.totalValue,
        metricChangePct: null,
        sentence: buildStuckOnlySentence({
          managerName: fact.managerName,
          stageLabel,
          dealCount: fact.bigDealFlags.length,
          totalValue: fact.totalValue,
        }),
      })
    }
  }

  // Портфельный (не по конкретному менеджеру) разрыв конверсии между стадиями — сравнение
  // сквозной воронки за последнюю неделю против предыдущей.
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const currentWeekStart = new Date(new Date(referenceISO).getTime() - weekMs).toISOString()
  const previousWeekStart = new Date(new Date(referenceISO).getTime() - 2 * weekMs).toISOString()
  const dealsEnteredBy = (startISO: string, endISO: string) =>
    deals.filter((d) => {
      const t = new Date(d.createdAt).getTime()
      return t >= new Date(startISO).getTime() && t < new Date(endISO).getTime()
    })

  const currentWeekConversions = calculateAdjacentStageConversions(dealsEnteredBy(currentWeekStart, referenceISO))
  const previousWeekConversions = calculateAdjacentStageConversions(dealsEnteredBy(previousWeekStart, currentWeekStart))
  const previousByPair = new Map(previousWeekConversions.map((c) => [`${c.from}::${c.to}`, c]))

  for (const current of currentWeekConversions) {
    if (current.rate === null) continue
    const previous = previousByPair.get(`${current.from}::${current.to}`)
    if (!previous || previous.rate === null) continue
    const dropPct = previous.rate - current.rate
    if (dropPct < CONVERSION_DROP_WARNING_PCT) continue
    recommendations.push({
      id: `conversion_drop_${current.from}_${current.to}`,
      type: 'conversion_drop',
      severity: dropPct >= CONVERSION_DROP_CRITICAL_PCT ? 'critical' : 'warning',
      managerId: null,
      managerName: null,
      stage: current.from,
      dealCount: null,
      totalValue: null,
      metricChangePct: -dropPct,
      sentence: buildConversionDropSentence({
        fromLabel: FUNNEL_STAGE_LABELS[current.from],
        toLabel: FUNNEL_STAGE_LABELS[current.to],
        dropPct,
      }),
    })
  }

  // Основная причина отказов.
  const lostBreakdown = buildLostReasonBreakdown(deals)
  const topLostReason = lostBreakdown[0]
  if (topLostReason && topLostReason.sharePct >= LOST_REASON_SHARE_WARNING_PCT) {
    recommendations.push({
      id: `lost_reason_${topLostReason.reason}`,
      type: 'lost_reason',
      severity: topLostReason.sharePct >= LOST_REASON_SHARE_WARNING_PCT * 1.5 ? 'critical' : 'warning',
      managerId: null,
      managerName: null,
      stage: null,
      dealCount: topLostReason.count,
      totalValue: null,
      metricChangePct: topLostReason.sharePct,
      sentence: buildLostReasonSentence({
        reasonLabel: LOST_REASON_LABELS[topLostReason.reason as keyof typeof LOST_REASON_LABELS] ?? topLostReason.reason,
        sharePct: topLostReason.sharePct,
      }),
    })
  }

  // Рост длины цикла сделки к прошлому периоду.
  const closedDeals = deals.filter((d) => d.outcome !== 'open')
  const sortedByClose = [...closedDeals].sort((a, b) => new Date(a.closedAt as string).getTime() - new Date(b.closedAt as string).getTime())
  const mid = Math.floor(sortedByClose.length / 2)
  const olderHalf = sortedByClose.slice(0, mid)
  const newerHalf = sortedByClose.slice(mid)
  const olderAvg = calculateAverageCycleLengthDays(olderHalf)
  const newerAvg = calculateAverageCycleLengthDays(newerHalf)
  if (olderAvg !== null && newerAvg !== null) {
    const growthPct = calculatePeriodGrowthPct(newerAvg, olderAvg)
    if (growthPct !== null && growthPct >= CYCLE_LENGTH_GROWTH_WARNING_PCT) {
      recommendations.push({
        id: 'cycle_length_growth',
        type: 'cycle_length',
        severity: growthPct >= CYCLE_LENGTH_GROWTH_WARNING_PCT * 1.5 ? 'critical' : 'warning',
        managerId: null,
        managerName: null,
        stage: null,
        dealCount: null,
        totalValue: null,
        metricChangePct: growthPct,
        sentence: buildCycleLengthSentence({ currentDays: newerAvg, growthPct }),
      })
    }
  }

  // Позитивная возможность: лучший менеджер по конверсии звонок → встреча, ещё не упомянутый выше.
  const withRate = conversionFacts.filter((f) => f.currentRate !== null && !usedManagerIds.has(f.managerId))
  const portfolioAvg =
    calculateConversionRate(
      activityLog.reduce((s, e) => s + e.meetings, 0),
      activityLog.reduce((s, e) => s + e.calls, 0),
    ) ?? null
  if (withRate.length > 0 && portfolioAvg !== null) {
    const best = withRate.reduce((a, b) => ((b.currentRate as number) > (a.currentRate as number) ? b : a))
    if ((best.currentRate as number) >= portfolioAvg * 1.25) {
      recommendations.push({
        id: `opportunity_${best.managerId}`,
        type: 'opportunity',
        severity: 'info',
        managerId: best.managerId,
        managerName: best.managerName,
        stage: null,
        dealCount: null,
        totalValue: null,
        metricChangePct: null,
        sentence: buildOpportunitySentence({
          managerName: best.managerName,
          conversionPct: best.currentRate as number,
          portfolioAvgPct: portfolioAvg,
        }),
      })
    }
  }

  const severityRank: Record<RecommendationSeverity, number> = { critical: 0, warning: 1, info: 2 }
  return recommendations.sort((a, b) => {
    const bySeverity = severityRank[a.severity] - severityRank[b.severity]
    if (bySeverity !== 0) return bySeverity
    return (b.totalValue ?? 0) - (a.totalValue ?? 0)
  })
}
