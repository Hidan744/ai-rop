import { describe, expect, it } from 'vitest'
import type { Deal } from '@/types/sales'
import {
  buildAttentionSummary,
  calculateWeekPotentialValue,
  isDealReadyToClose,
  isDealStageOverLimit,
  isDealWithoutActivity,
  isDealWithoutNextStep,
  isNextStepOverdue,
  nextStepOverdueDays,
} from './dealAttention'

const REFERENCE = '2026-09-26T00:00:00.000Z'

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'd1',
    title: 'Тестовая сделка',
    managerId: 'ivan',
    stage: 'new_lead',
    value: 100000,
    source: 'amocrm',
    createdAt: '2026-09-01T00:00:00.000Z',
    stageEnteredAt: '2026-09-01T00:00:00.000Z',
    stageHistory: [{ stage: 'new_lead', enteredAt: '2026-09-01T00:00:00.000Z' }],
    closedAt: null,
    outcome: 'open',
    lostReason: null,
    nextStep: null,
    lastActivityAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('isDealWithoutActivity', () => {
  it('is true for an open deal whose last activity is older than the threshold', () => {
    expect(isDealWithoutActivity(makeDeal({ lastActivityAt: '2026-09-10T00:00:00.000Z' }), REFERENCE)).toBe(true)
  })
  it('is false for a closed deal even with old activity', () => {
    expect(isDealWithoutActivity(makeDeal({ outcome: 'won', lastActivityAt: '2026-09-01T00:00:00.000Z' }), REFERENCE)).toBe(false)
  })
  it('is false within the threshold', () => {
    expect(isDealWithoutActivity(makeDeal({ lastActivityAt: '2026-09-24T00:00:00.000Z' }), REFERENCE)).toBe(false)
  })
})

describe('isNextStepOverdue / nextStepOverdueDays', () => {
  it('is false when there is no next step', () => {
    expect(isNextStepOverdue(makeDeal({ nextStep: null }), REFERENCE)).toBe(false)
  })
  it('is false for a closed deal even with a past next-step date', () => {
    const deal = makeDeal({ outcome: 'won', nextStep: { type: 'call', dueDate: '2026-09-01T00:00:00.000Z' } })
    expect(isNextStepOverdue(deal, REFERENCE)).toBe(false)
  })
  it('is true and reports whole days overdue for an open deal past its next-step date', () => {
    const deal = makeDeal({ nextStep: { type: 'send_contract', dueDate: '2026-09-20T00:00:00.000Z' } })
    expect(isNextStepOverdue(deal, REFERENCE)).toBe(true)
    expect(nextStepOverdueDays(deal, REFERENCE)).toBe(6)
  })
  it('is false and reports null for a future next-step date', () => {
    const deal = makeDeal({ nextStep: { type: 'call', dueDate: '2026-10-01T00:00:00.000Z' } })
    expect(isNextStepOverdue(deal, REFERENCE)).toBe(false)
    expect(nextStepOverdueDays(deal, REFERENCE)).toBeNull()
  })
})

describe('isDealStageOverLimit', () => {
  it('flags an open deal that has dwelt in its current stage past the absolute limit', () => {
    const deal = makeDeal({ stageEnteredAt: '2026-08-01T00:00:00.000Z' })
    expect(isDealStageOverLimit(deal, REFERENCE)).toBe(true)
  })
  it('does not flag a deal within the limit', () => {
    const deal = makeDeal({ stageEnteredAt: '2026-09-20T00:00:00.000Z' })
    expect(isDealStageOverLimit(deal, REFERENCE)).toBe(false)
  })
})

describe('isDealWithoutNextStep', () => {
  it('is true only for open deals with no next step assigned', () => {
    expect(isDealWithoutNextStep(makeDeal({ nextStep: null }))).toBe(true)
    expect(isDealWithoutNextStep(makeDeal({ nextStep: { type: 'call', dueDate: REFERENCE } }))).toBe(false)
    expect(isDealWithoutNextStep(makeDeal({ outcome: 'lost', nextStep: null }))).toBe(false)
  })
})

describe('isDealReadyToClose', () => {
  it('is true for a late-stage deal with high calibrated win probability', () => {
    const deal = makeDeal({ stage: 'negotiation' })
    expect(isDealReadyToClose(deal, { negotiation: 0.7 })).toBe(true)
  })
  it('is false for an early-stage deal even with high probability', () => {
    const deal = makeDeal({ stage: 'new_lead' })
    expect(isDealReadyToClose(deal, { new_lead: 0.9 })).toBe(false)
  })
  it('is false when probability is below the threshold', () => {
    const deal = makeDeal({ stage: 'proposal_sent' })
    expect(isDealReadyToClose(deal, { proposal_sent: 0.4 })).toBe(false)
  })
})

describe('calculateWeekPotentialValue', () => {
  it('sums weighted value only for open deals whose next step falls within the window', () => {
    const deals: Deal[] = [
      makeDeal({ id: 'a', value: 1_000_000, stage: 'negotiation', nextStep: { type: 'get_payment', dueDate: '2026-09-28T00:00:00.000Z' } }),
      makeDeal({ id: 'b', value: 500_000, stage: 'negotiation', nextStep: { type: 'call', dueDate: '2026-10-20T00:00:00.000Z' } }), // outside window
      makeDeal({ id: 'c', value: 300_000, stage: 'negotiation', nextStep: null }), // no next step
      makeDeal({ id: 'd', value: 900_000, stage: 'negotiation', outcome: 'won', nextStep: { type: 'get_payment', dueDate: '2026-09-27T00:00:00.000Z' } }), // closed
    ]
    const winProbByStage = { negotiation: 0.5 }
    expect(calculateWeekPotentialValue(deals, winProbByStage, REFERENCE)).toBe(500_000)
  })
})

describe('buildAttentionSummary', () => {
  it('aggregates all five counters plus the week potential value from open deals only', () => {
    const recent = '2026-09-25T00:00:00.000Z'
    const deals: Deal[] = [
      makeDeal({ id: 'a', lastActivityAt: '2026-09-01T00:00:00.000Z' }), // no activity
      makeDeal({ id: 'b', lastActivityAt: recent, nextStep: { type: 'call', dueDate: '2026-09-01T00:00:00.000Z' } }), // overdue next step
      makeDeal({ id: 'c', lastActivityAt: recent, stageEnteredAt: '2026-07-01T00:00:00.000Z' }), // stage over limit
      makeDeal({ id: 'd', lastActivityAt: recent, nextStep: null }), // no next step
      makeDeal({ id: 'e', lastActivityAt: recent, stage: 'negotiation' }), // ready to close
      makeDeal({ id: 'f', lastActivityAt: recent, outcome: 'lost' }), // closed — excluded from all open-based counters
    ]
    const summary = buildAttentionSummary(deals, { negotiation: 0.9 }, REFERENCE)
    expect(summary.noActivityCount).toBe(1)
    expect(summary.overdueNextStepCount).toBe(1)
    expect(summary.stageOverLimitCount).toBe(1)
    expect(summary.noNextStepCount).toBe(4) // a, c, d, e have no next step assigned (b does)
    expect(summary.readyToCloseCount).toBe(1)
  })
})
