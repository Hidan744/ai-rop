import { describe, expect, it } from 'vitest'
import type { ActivityLogEntry, Deal, Manager } from '@/types/sales'
import { buildManagerStuckFacts, buildRecommendations, buildStuckPlusConversionDropSentence } from './recommendations'

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
    ...overrides,
  }
}

const MANAGERS: Manager[] = [
  { id: 'ivan', name: 'Иван Соколов', initials: 'ИС' },
  { id: 'olga', name: 'Ольга Титова', initials: 'ОТ' },
]

describe('buildManagerStuckFacts', () => {
  it('groups big stuck deals by manager and stage, requiring at least the minimum count', () => {
    const deals = [
      makeDeal({ id: 'a', managerId: 'ivan', value: 900_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-01T00:00:00.000Z' }),
      makeDeal({ id: 'b', managerId: 'ivan', value: 700_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-05T00:00:00.000Z' }),
      makeDeal({ id: 'c', managerId: 'ivan', value: 600_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-10T00:00:00.000Z' }),
      // Below value threshold — excluded even though stuck.
      makeDeal({ id: 'd', managerId: 'olga', value: 50_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-01T00:00:00.000Z' }),
    ]
    const facts = buildManagerStuckFacts(deals, MANAGERS, REFERENCE)
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ managerId: 'ivan', stage: 'proposal_sent' })
    expect(facts[0].bigDealFlags).toHaveLength(3)
  })
})

describe('buildStuckPlusConversionDropSentence', () => {
  it('matches the exact structure from the product brief', () => {
    const sentence = buildStuckPlusConversionDropSentence({
      managerName: 'Иван',
      stageLabel: 'КП отправлено',
      dealCount: 3,
      conversionDropPct: 15,
    })
    expect(sentence).toBe(
      'Менеджер Иван завис на этапе КП отправлено по 3 крупным сделкам. Конверсия из звонка во встречу упала на 15% за неделю. Обратите внимание на его скрипт.',
    )
  })
})

describe('buildRecommendations', () => {
  it('produces the combined stuck+conversion-drop recommendation for a manager matching both conditions', () => {
    const deals: Deal[] = [
      makeDeal({ id: 'a', managerId: 'ivan', value: 900_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-01T00:00:00.000Z' }),
      makeDeal({ id: 'b', managerId: 'ivan', value: 700_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-05T00:00:00.000Z' }),
      makeDeal({ id: 'c', managerId: 'ivan', value: 600_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-10T00:00:00.000Z' }),
    ]
    const activityLog: ActivityLogEntry[] = [
      // Previous week: strong conversion (10 calls -> 5 meetings = 50%).
      { id: '1', managerId: 'ivan', date: '2026-09-14', calls: 10, meetings: 5 },
      // Current week: weak conversion (10 calls -> 2 meetings = 20%), a clear drop.
      { id: '2', managerId: 'ivan', date: '2026-09-21', calls: 10, meetings: 2 },
    ]
    const recs = buildRecommendations(deals, MANAGERS, activityLog, REFERENCE)
    const combined = recs.find((r) => r.id.startsWith('stuck_conv_'))
    expect(combined).toBeDefined()
    expect(combined?.sentence).toContain('Менеджер Иван Соколов завис на этапе КП отправлено')
    expect(combined?.sentence).toContain('Конверсия из звонка во встречу упала')
    expect(combined?.sentence).toContain('Обратите внимание на его скрипт.')
  })

  it('ranks recommendations by severity first, then by total value impact', () => {
    const deals: Deal[] = [
      makeDeal({ id: 'a', managerId: 'ivan', value: 900_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-01T00:00:00.000Z' }),
      makeDeal({ id: 'b', managerId: 'ivan', value: 700_000, stage: 'proposal_sent', stageEnteredAt: '2026-08-05T00:00:00.000Z' }),
      makeDeal({ id: 'c', managerId: 'olga', value: 2_000_000, stage: 'negotiation', stageEnteredAt: '2026-06-01T00:00:00.000Z' }),
      makeDeal({ id: 'd', managerId: 'olga', value: 1_800_000, stage: 'negotiation', stageEnteredAt: '2026-06-01T00:00:00.000Z' }),
      makeDeal({ id: 'e', managerId: 'olga', value: 1_500_000, stage: 'negotiation', stageEnteredAt: '2026-06-01T00:00:00.000Z' }),
    ]
    const recs = buildRecommendations(deals, MANAGERS, [], REFERENCE)
    const severityRank = { critical: 0, warning: 1, info: 2 }
    for (let i = 1; i < recs.length; i++) {
      expect(severityRank[recs[i].severity]).toBeGreaterThanOrEqual(severityRank[recs[i - 1].severity])
    }
  })

  it('returns an empty array when there is nothing to flag', () => {
    const recs = buildRecommendations([], MANAGERS, [], REFERENCE)
    expect(recs).toEqual([])
  })
})
