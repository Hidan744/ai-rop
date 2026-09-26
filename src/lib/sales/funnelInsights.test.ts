import { describe, expect, it } from 'vitest'
import type { ActivityLogEntry, Deal } from '@/types/sales'
import { buildStageTransitionExplanation } from './funnelInsights'

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

describe('buildStageTransitionExplanation', () => {
  it('counts moved-forward vs dropped deals entering `from` this week, with a rate', () => {
    const deals: Deal[] = [
      // Entered new_lead this week (createdAt in the last 7 days before REFERENCE), reached qualification.
      makeDeal({
        id: 'a',
        createdAt: '2026-09-22T00:00:00.000Z',
        stage: 'qualification',
        stageHistory: [
          { stage: 'new_lead', enteredAt: '2026-09-22T00:00:00.000Z' },
          { stage: 'qualification', enteredAt: '2026-09-23T00:00:00.000Z' },
        ],
      }),
      // Entered new_lead this week, still stuck there (did not reach qualification).
      makeDeal({ id: 'b', createdAt: '2026-09-23T00:00:00.000Z', stage: 'new_lead' }),
    ]
    const result = buildStageTransitionExplanation({ deals, activityLog: [], from: 'new_lead', to: 'qualification', referenceISO: REFERENCE })
    expect(result.movedForwardCount).toBe(1)
    expect(result.droppedCount).toBe(1)
    expect(result.currentRatePct).toBe(50)
    expect(result.sentence).toContain('1 из 2')
  })

  it('computes a positive trend when this week beats the previous week', () => {
    const deals: Deal[] = [
      // This week: 2 of 2 reached qualification (100%).
      makeDeal({
        id: 'a',
        createdAt: '2026-09-22T00:00:00.000Z',
        stage: 'qualification',
        stageHistory: [
          { stage: 'new_lead', enteredAt: '2026-09-22T00:00:00.000Z' },
          { stage: 'qualification', enteredAt: '2026-09-23T00:00:00.000Z' },
        ],
      }),
      makeDeal({
        id: 'b',
        createdAt: '2026-09-23T00:00:00.000Z',
        stage: 'qualification',
        stageHistory: [
          { stage: 'new_lead', enteredAt: '2026-09-23T00:00:00.000Z' },
          { stage: 'qualification', enteredAt: '2026-09-24T00:00:00.000Z' },
        ],
      }),
      // Previous week: 1 of 2 reached qualification (50%).
      makeDeal({
        id: 'c',
        createdAt: '2026-09-14T00:00:00.000Z',
        stage: 'qualification',
        stageHistory: [
          { stage: 'new_lead', enteredAt: '2026-09-14T00:00:00.000Z' },
          { stage: 'qualification', enteredAt: '2026-09-15T00:00:00.000Z' },
        ],
      }),
      makeDeal({ id: 'd', createdAt: '2026-09-15T00:00:00.000Z', stage: 'new_lead' }),
    ]
    const result = buildStageTransitionExplanation({ deals, activityLog: [], from: 'new_lead', to: 'qualification', referenceISO: REFERENCE })
    expect(result.trendPct).toBeGreaterThan(0)
    expect(result.sentence).toContain('выше прошлой недели')
  })

  it('surfaces the top lost reason among deals lost right after `from` without reaching `to`', () => {
    const deals: Deal[] = [
      makeDeal({
        id: 'a',
        createdAt: '2026-09-22T00:00:00.000Z',
        stage: 'lost',
        outcome: 'lost',
        lostReason: 'price',
        closedAt: '2026-09-24T00:00:00.000Z',
        stageHistory: [{ stage: 'new_lead', enteredAt: '2026-09-22T00:00:00.000Z' }],
      }),
    ]
    const result = buildStageTransitionExplanation({ deals, activityLog: [], from: 'new_lead', to: 'qualification', referenceISO: REFERENCE })
    expect(result.topLostReasons.length).toBeGreaterThan(0)
    expect(result.topLostReasons[0].reason).toBe('price')
    expect(result.sentence).toContain('Цена')
  })

  it('only fills callToMeetingRatePct for the transition into meeting_scheduled, reusing the same activity aggregation', () => {
    const activityLog: ActivityLogEntry[] = [{ id: '1', managerId: 'ivan', date: '2026-09-24', calls: 10, meetings: 4 }]
    const intoMeeting = buildStageTransitionExplanation({
      deals: [],
      activityLog,
      from: 'qualification',
      to: 'meeting_scheduled',
      referenceISO: REFERENCE,
    })
    expect(intoMeeting.callToMeetingRatePct).toBe(40)
    expect(intoMeeting.sentence).toContain('звонок → встреча')

    const otherTransition = buildStageTransitionExplanation({
      deals: [],
      activityLog,
      from: 'new_lead',
      to: 'qualification',
      referenceISO: REFERENCE,
    })
    expect(otherTransition.callToMeetingRatePct).toBeNull()
  })

  it('handles an empty week with no entered deals gracefully', () => {
    const result = buildStageTransitionExplanation({ deals: [], activityLog: [], from: 'proposal_sent', to: 'negotiation', referenceISO: REFERENCE })
    expect(result.movedForwardCount).toBe(0)
    expect(result.droppedCount).toBe(0)
    expect(result.sentence.length).toBeGreaterThan(0)
  })
})
