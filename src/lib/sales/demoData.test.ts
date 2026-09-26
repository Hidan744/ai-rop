import { describe, expect, it } from 'vitest'
import { buildDemoWorkspace } from './demoData'
import { buildRecommendations } from './recommendations'
import { flagStuckDeals } from './formulas'

describe('buildDemoWorkspace', () => {
  const now = new Date('2026-09-26T12:00:00.000Z')
  const workspace = buildDemoWorkspace(now)

  it('produces a plausible dataset size across managers, stages and sources', () => {
    expect(workspace.managers.length).toBeGreaterThanOrEqual(4)
    expect(workspace.deals.length).toBeGreaterThanOrEqual(40)
    expect(workspace.deals.length).toBeLessThanOrEqual(80)
    const sources = new Set(workspace.deals.map((d) => d.source))
    expect(sources.has('amocrm')).toBe(true)
    expect(sources.has('bitrix24')).toBe(true)
    expect(sources.has('csv')).toBe(true)
  })

  it('has at least one manager with stuck big deals on proposal_sent (the headline story)', () => {
    const flags = flagStuckDeals(workspace.deals, now.toISOString())
    const ivanStuck = flags.filter((f) => f.deal.managerId === 'mgr_ivan' && f.deal.stage === 'proposal_sent' && f.deal.value >= 400_000)
    expect(ivanStuck.length).toBeGreaterThanOrEqual(2)
  })

  it('generates a critical stuck-deal recommendation for that manager out of the box', () => {
    const recs = buildRecommendations(workspace.deals, workspace.managers, workspace.activityLog, now.toISOString())
    expect(recs.length).toBeGreaterThan(0)
    const ivanRec = recs.find((r) => r.managerId === 'mgr_ivan' && r.type === 'stuck_deals')
    expect(ivanRec).toBeDefined()
    expect(ivanRec?.severity).toBe('critical')
    expect(ivanRec?.sentence).toContain('Иван Соколов')
  })

  it('has at least three months of plan/fact history', () => {
    expect(workspace.planFactHistory.length).toBeGreaterThanOrEqual(3)
  })
})
