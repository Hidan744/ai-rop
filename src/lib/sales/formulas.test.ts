import { describe, expect, it } from 'vitest'
import type { Deal } from '@/types/sales'
import {
  applyWhatIfToForecast,
  average,
  calculateAdjacentStageConversions,
  calculateAverageCycleLengthDays,
  calculateConversionRate,
  calculateCurrentStageDwellDays,
  calculateDealCycleLengthDays,
  calculateOverallFunnelConversion,
  calculatePeriodGrowthPct,
  calculateStageMedianDwellDays,
  calculateWeightedPipelineValue,
  calibrateStageWinProbabilities,
  buildLostReasonBreakdown,
  daysBetween,
  extractCompletedStageDwellSamples,
  flagStuckDeals,
  median,
} from './formulas'

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'd1',
    title: 'Тестовая сделка',
    managerId: 'm1',
    stage: 'new_lead',
    value: 100000,
    source: 'amocrm',
    createdAt: '2026-09-01T00:00:00.000Z',
    stageEnteredAt: '2026-09-01T00:00:00.000Z',
    stageHistory: [{ stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' }],
    closedAt: null,
    outcome: 'open',
    lostReason: null,
    ...overrides,
  }
}

describe('daysBetween', () => {
  it('computes whole days between two ISO dates', () => {
    expect(daysBetween('2026-09-01T00:00:00.000Z', '2026-09-05T00:00:00.000Z')).toBe(4)
  })
  it('clamps negative intervals to 0', () => {
    expect(daysBetween('2026-09-05T00:00:00.000Z', '2026-09-01T00:00:00.000Z')).toBe(0)
  })
})

describe('calculateConversionRate', () => {
  it('computes count/total as a percentage', () => {
    expect(calculateConversionRate(25, 100)).toBe(25)
  })
  it('returns null when total is 0', () => {
    expect(calculateConversionRate(0, 0)).toBeNull()
  })
})

describe('calculatePeriodGrowthPct', () => {
  it('computes % change vs previous value', () => {
    expect(calculatePeriodGrowthPct(80, 100)).toBe(-20)
  })
  it('returns null when previous is 0', () => {
    expect(calculatePeriodGrowthPct(10, 0)).toBeNull()
  })
})

describe('median / average', () => {
  it('computes median for odd-length arrays', () => {
    expect(median([1, 3, 2])).toBe(2)
  })
  it('computes median for even-length arrays', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('returns null for empty arrays', () => {
    expect(median([])).toBeNull()
    expect(average([])).toBeNull()
  })
  it('computes average', () => {
    expect(average([1, 2, 3])).toBe(2)
  })
})

describe('calculateCurrentStageDwellDays', () => {
  it('measures days since entering the current stage, relative to reference date', () => {
    const deal = makeDeal({ stageEnteredAt: '2026-09-10T00:00:00.000Z' })
    expect(calculateCurrentStageDwellDays(deal, '2026-09-20T00:00:00.000Z')).toBe(10)
  })
  it('measures days up to closedAt for closed deals, not the reference date', () => {
    const deal = makeDeal({ stageEnteredAt: '2026-09-10T00:00:00.000Z', closedAt: '2026-09-12T00:00:00.000Z', outcome: 'won' })
    expect(calculateCurrentStageDwellDays(deal, '2026-09-30T00:00:00.000Z')).toBe(2)
  })
})

describe('extractCompletedStageDwellSamples', () => {
  it('derives completed stage intervals from stage history', () => {
    const deal = makeDeal({
      stageHistory: [
        { stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' },
        { stage: 'qualification', enteredAt: '2026-09-03T00:00:00.000Z' },
      ],
      stage: 'qualification',
      stageEnteredAt: '2026-09-03T00:00:00.000Z',
    })
    const samples = extractCompletedStageDwellSamples(deal)
    expect(samples).toEqual([{ stage: 'new_lead', days: 2 }])
  })
  it('includes the final stage interval when the deal is closed', () => {
    const deal = makeDeal({
      stageHistory: [{ stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' }],
      closedAt: '2026-09-04T00:00:00.000Z',
      outcome: 'won',
      stage: 'won',
    })
    expect(extractCompletedStageDwellSamples(deal)).toEqual([{ stage: 'new_lead', days: 3 }])
  })
})

describe('calculateStageMedianDwellDays', () => {
  it('computes the median completed dwell time per stage across deals', () => {
    const deals = [
      makeDeal({
        stageHistory: [
          { stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' },
          { stage: 'qualification', enteredAt: '2026-09-03T00:00:00.000Z' },
        ],
      }),
      makeDeal({
        stageHistory: [
          { stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' },
          { stage: 'qualification', enteredAt: '2026-09-06T00:00:00.000Z' },
        ],
      }),
    ]
    expect(calculateStageMedianDwellDays(deals).new_lead).toBe(3.5)
  })
})

describe('flagStuckDeals', () => {
  it('flags open deals well past the typical dwell time for their stage, ranked by value×overrun', () => {
    const reference = '2026-09-30T00:00:00.000Z'
    const deals = [
      // Historical closed deals establish a ~2-day typical dwell in proposal_sent.
      makeDeal({
        id: 'hist1',
        stageHistory: [
          { stage: 'proposal_sent', enteredAt: '2026-08-01T00:00:00.000Z' },
          { stage: 'negotiation', enteredAt: '2026-08-03T00:00:00.000Z' },
        ],
        closedAt: '2026-08-10T00:00:00.000Z',
        outcome: 'won',
        stage: 'won',
      }),
      // Stuck: sitting in proposal_sent for 20 days vs ~2-day median.
      makeDeal({
        id: 'stuck1',
        value: 2_000_000,
        stage: 'proposal_sent',
        stageEnteredAt: '2026-09-10T00:00:00.000Z',
        stageHistory: [{ stage: 'proposal_sent', enteredAt: '2026-09-10T00:00:00.000Z' }],
      }),
      // Fresh deal, not stuck.
      makeDeal({ id: 'fresh1', stage: 'new_lead', stageEnteredAt: '2026-09-29T00:00:00.000Z' }),
    ]
    const flags = flagStuckDeals(deals, reference)
    const ids = flags.map((f) => f.deal.id)
    expect(ids).toContain('stuck1')
    expect(ids).not.toContain('fresh1')
  })

  it('ranks a stuck high-value deal above a stuck low-value deal with the same overrun', () => {
    const reference = '2026-09-30T00:00:00.000Z'
    const deals = [
      makeDeal({ id: 'big', value: 2_000_000, stage: 'proposal_sent', stageEnteredAt: '2026-09-01T00:00:00.000Z' }),
      makeDeal({ id: 'small', value: 50_000, stage: 'proposal_sent', stageEnteredAt: '2026-09-01T00:00:00.000Z' }),
    ]
    const flags = flagStuckDeals(deals, reference, {})
    expect(flags[0].deal.id).toBe('big')
  })

  it('excludes closed deals', () => {
    const deals = [makeDeal({ outcome: 'won', closedAt: '2026-09-01T00:00:00.000Z', stageEnteredAt: '2026-01-01T00:00:00.000Z' })]
    expect(flagStuckDeals(deals, '2026-09-30T00:00:00.000Z')).toHaveLength(0)
  })
})

describe('calculateAdjacentStageConversions', () => {
  it('computes conversion between each adjacent stage pair from stage history', () => {
    const deals = [
      makeDeal({ id: 'a', stage: 'negotiation', stageHistory: [
        { stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' },
        { stage: 'qualification', enteredAt: '2026-09-02T00:00:00.000Z' },
        { stage: 'meeting_scheduled', enteredAt: '2026-09-03T00:00:00.000Z' },
        { stage: 'proposal_sent', enteredAt: '2026-09-04T00:00:00.000Z' },
        { stage: 'negotiation', enteredAt: '2026-09-05T00:00:00.000Z' },
      ] }),
      makeDeal({ id: 'b', stage: 'qualification', stageHistory: [
        { stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' },
        { stage: 'qualification', enteredAt: '2026-09-02T00:00:00.000Z' },
      ] }),
    ]
    const conversions = calculateAdjacentStageConversions(deals, ['new_lead', 'qualification', 'meeting_scheduled'])
    expect(conversions[0]).toMatchObject({ from: 'new_lead', to: 'qualification', enteredFrom: 2, reachedTo: 2, rate: 100 })
    expect(conversions[1]).toMatchObject({ from: 'qualification', to: 'meeting_scheduled', enteredFrom: 2, reachedTo: 1, rate: 50 })
  })
})

describe('calculateOverallFunnelConversion', () => {
  it('computes end-to-end conversion from first stage to won', () => {
    const deals = [
      makeDeal({ id: 'won1', stage: 'won', outcome: 'won', closedAt: '2026-09-10T00:00:00.000Z' }),
      makeDeal({ id: 'lost1', stage: 'lost', outcome: 'lost', closedAt: '2026-09-10T00:00:00.000Z', lostReason: 'price' }),
    ]
    expect(calculateOverallFunnelConversion(deals)).toBe(50)
  })
})

describe('calculateDealCycleLengthDays / calculateAverageCycleLengthDays', () => {
  it('returns null for open deals', () => {
    expect(calculateDealCycleLengthDays(makeDeal())).toBeNull()
  })
  it('computes days from creation to close', () => {
    const deal = makeDeal({ createdAt: '2026-09-01T00:00:00.000Z', closedAt: '2026-09-15T00:00:00.000Z', outcome: 'won' })
    expect(calculateDealCycleLengthDays(deal)).toBe(14)
  })
  it('averages only closed deals', () => {
    const deals = [
      makeDeal({ createdAt: '2026-09-01T00:00:00.000Z', closedAt: '2026-09-11T00:00:00.000Z', outcome: 'won' }),
      makeDeal({ createdAt: '2026-09-01T00:00:00.000Z', closedAt: '2026-09-21T00:00:00.000Z', outcome: 'lost', lostReason: 'price' }),
      makeDeal({ id: 'open', outcome: 'open' }),
    ]
    expect(calculateAverageCycleLengthDays(deals)).toBe(15)
  })
})

describe('buildLostReasonBreakdown', () => {
  it('counts and computes share per lost reason, sorted descending', () => {
    const deals = [
      makeDeal({ id: '1', outcome: 'lost', lostReason: 'price' }),
      makeDeal({ id: '2', outcome: 'lost', lostReason: 'price' }),
      makeDeal({ id: '3', outcome: 'lost', lostReason: 'no_budget' }),
      makeDeal({ id: '4', outcome: 'won' }),
    ]
    const breakdown = buildLostReasonBreakdown(deals)
    expect(breakdown[0]).toMatchObject({ reason: 'price', count: 2, sharePct: expect.closeTo(66.7, 0) })
    expect(breakdown[1]).toMatchObject({ reason: 'no_budget', count: 1 })
  })
})

describe('calibrateStageWinProbabilities', () => {
  it('computes per-stage win rate from closed deals that passed through the stage', () => {
    const deals = [
      makeDeal({ id: 'w1', outcome: 'won', stage: 'won', closedAt: '2026-09-10T00:00:00.000Z', stageHistory: [
        { stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' },
        { stage: 'negotiation', enteredAt: '2026-09-05T00:00:00.000Z' },
      ] }),
      makeDeal({ id: 'l1', outcome: 'lost', lostReason: 'price', stage: 'lost', closedAt: '2026-09-10T00:00:00.000Z', stageHistory: [
        { stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' },
      ] }),
    ]
    const probs = calibrateStageWinProbabilities(deals)
    expect(probs.new_lead).toBeCloseTo(0.5)
    expect(probs.negotiation).toBeCloseTo(1)
  })
})

describe('calculateWeightedPipelineValue', () => {
  it('sums value × win probability for the deal stage', () => {
    const deals = [
      { value: 100000, stage: 'negotiation' as const },
      { value: 200000, stage: 'new_lead' as const },
    ]
    const value = calculateWeightedPipelineValue(deals, { negotiation: 0.5, new_lead: 0.1 })
    expect(value).toBe(100000 * 0.5 + 200000 * 0.1)
  })
})

describe('applyWhatIfToForecast', () => {
  it('returns the base forecast unchanged for default (zero) params', () => {
    const result = applyWhatIfToForecast({
      baseWeightedForecast: 1_000_000,
      currentHeadcount: 5,
      params: { leadVolumeChangePct: 0, conversionRateChangePct: 0, avgDealSizeChangePct: 0, headcountDelta: 0 },
    })
    expect(result).toBe(1_000_000)
  })

  it('scales proportionally for lead volume, conversion, deal size and headcount changes', () => {
    const result = applyWhatIfToForecast({
      baseWeightedForecast: 1_000_000,
      currentHeadcount: 4,
      params: { leadVolumeChangePct: 20, conversionRateChangePct: -10, avgDealSizeChangePct: 10, headcountDelta: 2 },
    })
    // 1.2 * 0.9 * 1.1 * 1.5 = 1.782
    expect(result).toBeCloseTo(1_782_000, -1)
  })

  it('never goes negative even with extreme negative params', () => {
    const result = applyWhatIfToForecast({
      baseWeightedForecast: 1_000_000,
      currentHeadcount: 4,
      params: { leadVolumeChangePct: -200, conversionRateChangePct: 0, avgDealSizeChangePct: 0, headcountDelta: 0 },
    })
    expect(result).toBe(0)
  })
})
