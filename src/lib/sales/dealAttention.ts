/**
 * «🔥 Требуют внимания» — какие открытые сделки нуждаются в действии прямо сейчас: без
 * активности, просрочили следующий шаг, застряли в стадии, не имеют назначенного следующего
 * шага, или наоборот — готовы к закрытию. Чистые функции поверх Deal.nextStep/lastActivityAt,
 * тот же приём, что и flagStuckDeals в formulas.ts (детерминированно, без обращения к LLM/бэкенду).
 */
import { calculateCurrentStageDwellDays, daysBetween } from './formulas'
import type { Deal, FunnelStage } from '@/types/sales'

/** Сколько дней без активности по сделке считается тревожным сигналом. */
export const NO_ACTIVITY_THRESHOLD_DAYS = 5
/** Сколько дней в одной стадии считается «застряла», независимо от медианы по компании. */
export const STAGE_OVER_LIMIT_DAYS = 30
/** Минимальная калиброванная вероятность выигрыша стадии, чтобы сделка считалась «готовой к закрытию». */
export const READY_TO_CLOSE_MIN_PROBABILITY = 0.6
/** Стадии, с которых сделка может считаться «готовой к закрытию» — только поздние этапы воронки. */
const READY_TO_CLOSE_STAGES: FunnelStage[] = ['proposal_sent', 'negotiation']
/** Ширина окна «на этой неделе» для потенциального объёма по ближайшим следующим шагам. */
export const WEEK_POTENTIAL_WINDOW_DAYS = 7

export function daysSinceLastActivity(deal: Pick<Deal, 'lastActivityAt'>, referenceISO: string): number {
  return daysBetween(deal.lastActivityAt, referenceISO)
}

/** Открытая сделка без свежей активности дольше порога. */
export function isDealWithoutActivity(deal: Deal, referenceISO: string, thresholdDays = NO_ACTIVITY_THRESHOLD_DAYS): boolean {
  if (deal.outcome !== 'open') return false
  return daysSinceLastActivity(deal, referenceISO) > thresholdDays
}

/** Открытая сделка, у которой назначенный следующий шаг просрочен. */
export function isNextStepOverdue(deal: Pick<Deal, 'outcome' | 'nextStep'>, referenceISO: string): boolean {
  if (deal.outcome !== 'open' || !deal.nextStep) return false
  return new Date(deal.nextStep.dueDate).getTime() < new Date(referenceISO).getTime()
}

/** На сколько (целых) дней просрочен следующий шаг. null, если не просрочен/не назначен. */
export function nextStepOverdueDays(deal: Pick<Deal, 'outcome' | 'nextStep'>, referenceISO: string): number | null {
  if (!isNextStepOverdue(deal, referenceISO)) return null
  return Math.floor(daysBetween((deal as Deal).nextStep!.dueDate, referenceISO))
}

/** Открытая сделка, зависшая в текущей стадии дольше абсолютного лимита (не зависит от медианы). */
export function isDealStageOverLimit(deal: Deal, referenceISO: string, thresholdDays = STAGE_OVER_LIMIT_DAYS): boolean {
  if (deal.outcome !== 'open') return false
  return calculateCurrentStageDwellDays(deal, referenceISO) > thresholdDays
}

/** Открытая сделка без назначенного следующего шага — сама по себе сигнал внимания. */
export function isDealWithoutNextStep(deal: Deal): boolean {
  return deal.outcome === 'open' && deal.nextStep === null
}

/** Открытая сделка на поздней стадии с высокой калиброванной вероятностью выигрыша — «дожать». */
export function isDealReadyToClose(deal: Deal, winProbByStage: Partial<Record<FunnelStage, number>>): boolean {
  if (deal.outcome !== 'open') return false
  if (!READY_TO_CLOSE_STAGES.includes(deal.stage)) return false
  const prob = winProbByStage[deal.stage] ?? null
  return prob !== null && prob >= READY_TO_CLOSE_MIN_PROBABILITY
}

/** Сумма взвешенных сумм сделок, чей следующий шаг запланирован в ближайшие windowDays дней. */
export function calculateWeekPotentialValue(
  deals: Deal[],
  winProbByStage: Partial<Record<FunnelStage, number>>,
  referenceISO: string,
  windowDays = WEEK_POTENTIAL_WINDOW_DAYS,
): number {
  const now = new Date(referenceISO).getTime()
  const windowEnd = now + windowDays * 24 * 60 * 60 * 1000
  return deals
    .filter((d) => {
      if (d.outcome !== 'open' || !d.nextStep) return false
      const due = new Date(d.nextStep.dueDate).getTime()
      return due >= now && due <= windowEnd
    })
    .reduce((sum, d) => sum + d.value * (winProbByStage[d.stage] ?? 0), 0)
}

export interface AttentionSummary {
  noActivityCount: number
  overdueNextStepCount: number
  stageOverLimitCount: number
  noNextStepCount: number
  readyToCloseCount: number
  weekPotentialValue: number
}

/** Сводка для блока «🔥 Требуют внимания» — все счётчики считаются только по открытым сделкам. */
export function buildAttentionSummary(
  deals: Deal[],
  winProbByStage: Partial<Record<FunnelStage, number>>,
  referenceISO: string,
): AttentionSummary {
  const open = deals.filter((d) => d.outcome === 'open')
  return {
    noActivityCount: open.filter((d) => isDealWithoutActivity(d, referenceISO)).length,
    overdueNextStepCount: open.filter((d) => isNextStepOverdue(d, referenceISO)).length,
    stageOverLimitCount: open.filter((d) => isDealStageOverLimit(d, referenceISO)).length,
    noNextStepCount: open.filter(isDealWithoutNextStep).length,
    readyToCloseCount: open.filter((d) => isDealReadyToClose(d, winProbByStage)).length,
    weekPotentialValue: calculateWeekPotentialValue(deals, winProbByStage, referenceISO),
  }
}
