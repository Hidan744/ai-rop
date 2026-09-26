/**
 * Базовые формулы аналитики отдела продаж. Все функции — чистые, без побочных эффектов.
 * Деление на ноль / некорректные входные данные не бросают исключений и не возвращают NaN —
 * они возвращают null, а UI обязан обработать null явно (тот же приём, что и в
 * src/lib/marketing/formulas.ts у AI CMO / src/lib/finance/formulas.ts у Business Financial OS).
 */
import type { Deal, FunnelStage } from '@/types/sales'
import { OPEN_FUNNEL_STAGES } from '@/types/sales'

const DAY_MS = 1000 * 60 * 60 * 24

/** Количество (дробных) дней между двумя ISO-датами. Отрицательный интервал обрезается до 0. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO).getTime()
  const to = new Date(toISO).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, (to - from) / DAY_MS)
}

/** Конверсия count/total в процентах. null, если знаменатель <= 0. */
export function calculateConversionRate(count: number, total: number): number | null {
  if (total <= 0) return null
  return (count / total) * 100
}

/** % изменения показателя к предыдущему значению. null, если базовое значение — 0. */
export function calculatePeriodGrowthPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Медиана числового массива. null для пустого массива. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Среднее числового массива. null для пустого массива. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Сколько (дробных) дней сделка провела в СВОЕЙ ТЕКУЩЕЙ стадии на момент referenceDate.
 * Для закрытых сделок (won/lost) считает время до закрытия, а не до «сейчас».
 */
export function calculateCurrentStageDwellDays(deal: Deal, referenceISO: string): number {
  const until = deal.closedAt ?? referenceISO
  return daysBetween(deal.stageEnteredAt, until)
}

export interface StageDwellSample {
  stage: FunnelStage
  days: number
}

/**
 * Извлекает завершённые интервалы «сколько дней сделка провела в каждой стадии» из истории
 * стадий — интервал между входом в стадию и входом в следующую (или закрытием сделки).
 * Используется как обучающая выборка для «типичного» (медианного) времени в стадии.
 */
export function extractCompletedStageDwellSamples(deal: Deal): StageDwellSample[] {
  const samples: StageDwellSample[] = []
  const history = deal.stageHistory
  for (let i = 0; i < history.length; i++) {
    const entry = history[i]
    const next = history[i + 1]
    const endISO = next ? next.enteredAt : deal.closedAt
    if (!endISO) continue // текущая незакрытая стадия — не завершённый интервал
    samples.push({ stage: entry.stage, days: daysBetween(entry.enteredAt, endISO) })
  }
  return samples
}

/** Медианное («типичное») время в каждой стадии по всей истории сделок (закрытым интервалам). */
export function calculateStageMedianDwellDays(deals: Deal[]): Partial<Record<FunnelStage, number>> {
  const byStage = new Map<FunnelStage, number[]>()
  for (const deal of deals) {
    for (const sample of extractCompletedStageDwellSamples(deal)) {
      const arr = byStage.get(sample.stage) ?? []
      arr.push(sample.days)
      byStage.set(sample.stage, arr)
    }
  }
  const result: Partial<Record<FunnelStage, number>> = {}
  for (const [stage, days] of byStage) {
    const m = median(days)
    if (m !== null) result[stage] = m
  }
  return result
}

/** Во сколько раз дольше медианного времени в стадии считается «зависшей» сделкой. */
export const STUCK_DWELL_MULTIPLIER = 1.5
/** Абсолютный минимум дней в стадии, ниже которого сделка не считается зависшей даже без медианы. */
export const STUCK_DWELL_FLOOR_DAYS = 7

export interface StuckDealFlag {
  deal: Deal
  daysInStage: number
  typicalDwellDays: number | null
  /** daysInStage / typicalDwellDays — во сколько раз сделка превышает норму (1, если нормы нет). */
  overrunRatio: number
}

/**
 * Помечает сделки, застрявшие в текущей стадии дольше типичного (медианного) времени,
 * взвешенных по стоимости — их daysInStage/typicalDwellDays и value используются дальше
 * для ранжирования: зависшая сделка на ₽2 млн важнее зависшей на ₽50 тыс.
 */
export function flagStuckDeals(
  deals: Deal[],
  referenceISO: string,
  stageMedianDwellDays: Partial<Record<FunnelStage, number>> = calculateStageMedianDwellDays(deals),
): StuckDealFlag[] {
  const flags: StuckDealFlag[] = []
  for (const deal of deals) {
    if (deal.outcome !== 'open') continue
    const daysInStage = calculateCurrentStageDwellDays(deal, referenceISO)
    const typical = stageMedianDwellDays[deal.stage] ?? null
    const threshold = typical !== null ? Math.max(typical * STUCK_DWELL_MULTIPLIER, STUCK_DWELL_FLOOR_DAYS) : STUCK_DWELL_FLOOR_DAYS * 2
    if (daysInStage < threshold) continue
    flags.push({
      deal,
      daysInStage,
      typicalDwellDays: typical,
      overrunRatio: typical && typical > 0 ? daysInStage / typical : daysInStage / STUCK_DWELL_FLOOR_DAYS,
    })
  }
  return flags.sort((a, b) => b.deal.value * b.overrunRatio - a.deal.value * a.overrunRatio)
}

export interface AdjacentStageConversion {
  from: FunnelStage
  to: FunnelStage
  /** Сколько сделок когда-либо вошли в `from`. */
  enteredFrom: number
  /** Сколько из них дошли и до `to`. */
  reachedTo: number
  rate: number | null
}

function dealReachedStage(deal: Deal, stage: FunnelStage): boolean {
  if (deal.stage === stage) return true
  return deal.stageHistory.some((h) => h.stage === stage)
}

/** Считает конверсию между каждой парой соседних стадий воронки по истории прохождения сделок. */
export function calculateAdjacentStageConversions(
  deals: Deal[],
  stages: FunnelStage[] = [...OPEN_FUNNEL_STAGES, 'won'],
): AdjacentStageConversion[] {
  const result: AdjacentStageConversion[] = []
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i]
    const to = stages[i + 1]
    const enteredFrom = deals.filter((d) => dealReachedStage(d, from)).length
    const reachedTo = deals.filter((d) => dealReachedStage(d, from) && dealReachedStage(d, to)).length
    result.push({ from, to, enteredFrom, reachedTo, rate: calculateConversionRate(reachedTo, enteredFrom) })
  }
  return result
}

/** Полная (сквозная) конверсия из первой стадии воронки в «Закрыта (успех)». */
export function calculateOverallFunnelConversion(deals: Deal[]): number | null {
  const first = OPEN_FUNNEL_STAGES[0]
  const total = deals.filter((d) => dealReachedStage(d, first)).length
  const won = deals.filter((d) => d.outcome === 'won').length
  return calculateConversionRate(won, total)
}

/** Длина цикла сделки (дни от создания до закрытия). null для ещё открытых сделок. */
export function calculateDealCycleLengthDays(deal: Deal): number | null {
  if (!deal.closedAt) return null
  return daysBetween(deal.createdAt, deal.closedAt)
}

/** Средняя длина цикла по закрытым (won/lost) сделкам. */
export function calculateAverageCycleLengthDays(deals: Deal[]): number | null {
  const values = deals.map(calculateDealCycleLengthDays).filter((v): v is number => v !== null)
  return average(values)
}

export interface LostReasonBreakdownItem {
  reason: string
  count: number
  sharePct: number
}

/** Разбивка причин отказов: количество и доля от всех отказов. Отсортировано по убыванию. */
export function buildLostReasonBreakdown(deals: Deal[]): LostReasonBreakdownItem[] {
  const lost = deals.filter((d) => d.outcome === 'lost' && d.lostReason)
  const counts = new Map<string, number>()
  for (const d of lost) {
    const key = d.lostReason as string
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = lost.length
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count, sharePct: calculateConversionRate(count, total) ?? 0 }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Калибрует вероятность выигрыша по каждой стадии на основе истории: доля закрытых (won/lost)
 * сделок, которые ПРОШЛИ через стадию и закончились победой. Основа для взвешенного прогноза
 * воронки — вероятность выше для более поздних стадий.
 */
export function calibrateStageWinProbabilities(deals: Deal[]): Partial<Record<FunnelStage, number>> {
  const closed = deals.filter((d) => d.outcome === 'won' || d.outcome === 'lost')
  const result: Partial<Record<FunnelStage, number>> = {}
  for (const stage of OPEN_FUNNEL_STAGES) {
    const reached = closed.filter((d) => dealReachedStage(d, stage))
    const won = reached.filter((d) => d.outcome === 'won')
    const rate = calculateConversionRate(won.length, reached.length)
    if (rate !== null) result[stage] = rate / 100
  }
  return result
}

export interface PipelineDeal {
  value: number
  stage: FunnelStage
}

/** Взвешенная стоимость воронки: сумма value × вероятность выигрыша стадии сделки. */
export function calculateWeightedPipelineValue(
  deals: PipelineDeal[],
  winProbByStage: Partial<Record<FunnelStage, number>>,
): number {
  return deals.reduce((sum, d) => sum + d.value * (winProbByStage[d.stage] ?? 0), 0)
}

export interface WhatIfParams {
  /** % изменения количества входящих лидов, напр. +20 или -15. */
  leadVolumeChangePct: number
  /** % изменения вероятности конверсии (применяется ко всем стадиям воронки одинаково). */
  conversionRateChangePct: number
  /** % изменения среднего размера сделки. */
  avgDealSizeChangePct: number
  /** Изменение числа менеджеров (штук), напр. +2 или -1. */
  headcountDelta: number
}

export const DEFAULT_WHAT_IF_PARAMS: WhatIfParams = {
  leadVolumeChangePct: 0,
  conversionRateChangePct: 0,
  avgDealSizeChangePct: 0,
  headcountDelta: 0,
}

/**
 * Пересчитывает взвешенный прогноз с учётом what-if параметров симулятора — чистая функция,
 * пересчитывается на клиенте при каждом движении ползунка, без обращения к бэкенду.
 * Объём лидов и штат менеджеров моделируются как пропорциональные множители к размеру
 * воронки (упрощение, приемлемое для MVP-симулятора), конверсия и средний чек — прямые
 * множители к вероятности выигрыша и сумме сделки соответственно.
 */
export function applyWhatIfToForecast(input: {
  baseWeightedForecast: number
  currentHeadcount: number
  params: WhatIfParams
}): number {
  const { baseWeightedForecast, currentHeadcount, params } = input
  const leadFactor = Math.max(0, 1 + params.leadVolumeChangePct / 100)
  const dealSizeFactor = Math.max(0, 1 + params.avgDealSizeChangePct / 100)
  const conversionFactor = Math.max(0, 1 + params.conversionRateChangePct / 100)
  const headcountFactor =
    currentHeadcount > 0 ? Math.max(0, currentHeadcount + params.headcountDelta) / currentHeadcount : 1
  return baseWeightedForecast * leadFactor * dealSizeFactor * conversionFactor * headcountFactor
}
