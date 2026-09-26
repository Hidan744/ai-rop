import { describe, expect, it } from 'vitest'
import type { Manager } from '@/types/sales'
import {
  buildManagerTaskSummaries,
  buildTaskTitleFromRecommendation,
  groupTasksByStatus,
  isTaskOpen,
  isTaskOverdue,
  pickSimulatedManagerReply,
  sortTasks,
  type Task,
} from './tasks'

const REFERENCE = '2026-09-26T00:00:00.000Z'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    managerId: 'ivan',
    title: 'Тестовая задача',
    description: null,
    dealId: null,
    dueDate: null,
    status: 'new',
    createdAt: '2026-09-20T00:00:00.000Z',
    comments: [],
    ...overrides,
  }
}

const MANAGERS: Manager[] = [
  { id: 'ivan', name: 'Иван Соколов', initials: 'ИС' },
  { id: 'olga', name: 'Ольга Титова', initials: 'ОТ' },
]

describe('isTaskOverdue', () => {
  it('is false for a done task even with a past due date', () => {
    const task = makeTask({ status: 'done', dueDate: '2026-09-01T00:00:00.000Z' })
    expect(isTaskOverdue(task, REFERENCE)).toBe(false)
  })

  it('is false when there is no due date', () => {
    expect(isTaskOverdue(makeTask({ dueDate: null }), REFERENCE)).toBe(false)
  })

  it('is true for an open task whose due date has passed', () => {
    const task = makeTask({ status: 'in_progress', dueDate: '2026-09-20T00:00:00.000Z' })
    expect(isTaskOverdue(task, REFERENCE)).toBe(true)
  })

  it('is false for an open task whose due date is in the future', () => {
    const task = makeTask({ status: 'new', dueDate: '2026-10-01T00:00:00.000Z' })
    expect(isTaskOverdue(task, REFERENCE)).toBe(false)
  })
})

describe('isTaskOpen', () => {
  it('is true for new/in_progress and false for done', () => {
    expect(isTaskOpen(makeTask({ status: 'new' }))).toBe(true)
    expect(isTaskOpen(makeTask({ status: 'in_progress' }))).toBe(true)
    expect(isTaskOpen(makeTask({ status: 'done' }))).toBe(false)
  })
})

describe('buildManagerTaskSummaries', () => {
  it('counts open/overdue/done per manager, including managers with zero tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', managerId: 'ivan', status: 'in_progress', dueDate: '2026-09-01T00:00:00.000Z' }), // overdue
      makeTask({ id: 'b', managerId: 'ivan', status: 'new', dueDate: '2026-10-01T00:00:00.000Z' }), // open, not overdue
      makeTask({ id: 'c', managerId: 'ivan', status: 'done', dueDate: '2026-09-01T00:00:00.000Z' }), // done
    ]
    const summaries = buildManagerTaskSummaries(tasks, MANAGERS, REFERENCE)
    const ivan = summaries.find((s) => s.managerId === 'ivan')
    const olga = summaries.find((s) => s.managerId === 'olga')
    expect(ivan).toMatchObject({ openCount: 2, overdueCount: 1, doneCount: 1, totalCount: 3 })
    expect(olga).toMatchObject({ openCount: 0, overdueCount: 0, doneCount: 0, totalCount: 0 })
  })
})

describe('sortTasks', () => {
  it('puts overdue tasks first, then sorts by due date, then newest-created first when no due date', () => {
    const tasks: Task[] = [
      makeTask({ id: 'no-due-older', dueDate: null, createdAt: '2026-09-10T00:00:00.000Z' }),
      makeTask({ id: 'no-due-newer', dueDate: null, createdAt: '2026-09-15T00:00:00.000Z' }),
      makeTask({ id: 'future', dueDate: '2026-10-05T00:00:00.000Z' }),
      makeTask({ id: 'overdue-far', status: 'new', dueDate: '2026-09-01T00:00:00.000Z' }),
      makeTask({ id: 'overdue-near', status: 'new', dueDate: '2026-09-20T00:00:00.000Z' }),
    ]
    const sorted = sortTasks(tasks, REFERENCE)
    expect(sorted.map((t) => t.id)).toEqual(['overdue-far', 'overdue-near', 'future', 'no-due-newer', 'no-due-older'])
  })
})

describe('groupTasksByStatus', () => {
  it('buckets tasks by status while preserving sortTasks ordering within each bucket', () => {
    const tasks: Task[] = [
      makeTask({ id: 'n1', status: 'new', dueDate: '2026-09-01T00:00:00.000Z' }), // overdue
      makeTask({ id: 'n2', status: 'new', dueDate: '2026-10-01T00:00:00.000Z' }),
      makeTask({ id: 'p1', status: 'in_progress' }),
      makeTask({ id: 'd1', status: 'done' }),
    ]
    const groups = groupTasksByStatus(tasks, REFERENCE)
    expect(groups.new.map((t) => t.id)).toEqual(['n1', 'n2'])
    expect(groups.in_progress.map((t) => t.id)).toEqual(['p1'])
    expect(groups.done.map((t) => t.id)).toEqual(['d1'])
  })
})

describe('buildTaskTitleFromRecommendation', () => {
  it('extracts the first sentence as the task title', () => {
    const title = buildTaskTitleFromRecommendation({
      sentence: 'Менеджер Иван Соколов завис на этапе КП отправлено по 3 крупным сделкам. Конверсия упала на 20% за неделю.',
    })
    expect(title).toBe('Менеджер Иван Соколов завис на этапе КП отправлено по 3 крупным сделкам.')
  })

  it('falls back to the whole sentence when there is no internal stop', () => {
    const title = buildTaskTitleFromRecommendation({ sentence: 'Короткая рекомендация без внутренней точки' })
    expect(title).toBe('Короткая рекомендация без внутренней точки.')
  })
})

describe('pickSimulatedManagerReply', () => {
  it('is deterministic for the same task id and comment count', () => {
    const a = pickSimulatedManagerReply('task_abc', 0)
    const b = pickSimulatedManagerReply('task_abc', 0)
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('varies as the comment count grows, so repeated clicks do not loop on the first click', () => {
    const first = pickSimulatedManagerReply('task_abc', 0)
    const second = pickSimulatedManagerReply('task_abc', 1)
    expect(second).not.toBe(first)
  })

  it('varies across different task ids for the same comment count', () => {
    const a = pickSimulatedManagerReply('task_abc', 0)
    const b = pickSimulatedManagerReply('task_xyz', 0)
    // Not a strict guarantee for every possible pair, but true for these two fixtures — guards
    // against a constant/near-constant implementation.
    expect(a).not.toBe(b)
  })
})
