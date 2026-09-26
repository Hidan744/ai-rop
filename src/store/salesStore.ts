import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/id'
import { buildDemoWorkspace } from '@/lib/sales/demoData'
import type { CsvDealRow } from '@/lib/sales/csvDealImport'
import { pickSimulatedManagerReply, type Task, type TaskStatus } from '@/lib/sales/tasks'
import type { ActivityLogEntry, CrmChoice, Deal, Manager, MonthlyPlanFact, SalesProfile } from '@/types/sales'

interface SalesStoreState {
  hasHydrated: boolean
  onboardingComplete: boolean
  profile: SalesProfile | null
  managers: Manager[]
  deals: Deal[]
  activityLog: ActivityLogEntry[]
  planFactHistory: MonthlyPlanFact[]
  tasks: Task[]

  completeOnboarding: (input: { companyName: string; niche: string; monthlyPlan: number; crm: CrmChoice }) => void
  loadDemo: () => void
  reset: () => void

  addManager: (name: string) => void

  updateMonthlyPlan: (value: number) => void

  importDealsFromCsv: (rows: CsvDealRow[]) => { importedCount: number; createdManagers: string[] }

  /** Ставит менеджеру новую задачу — из рекомендации, из карточки сделки или вручную. */
  createTask: (input: { managerId: string; title: string; description?: string | null; dealId?: string | null; startDate?: string | null; dueDate?: string | null }) => Task
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  /** РОП пишет комментарий в тред задачи — это и есть канал обратной связи в демо-продукте. */
  addComment: (taskId: string, text: string) => void
  /** Демо-приём (не реальная интеграция): подставляет правдоподобный ответ менеджера в тред. */
  simulateManagerReply: (taskId: string) => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export const useSalesStore = create<SalesStoreState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      onboardingComplete: false,
      profile: null,
      managers: [],
      deals: [],
      activityLog: [],
      planFactHistory: [],
      tasks: [],

      completeOnboarding: ({ companyName, niche, monthlyPlan, crm }) => {
        const profile: SalesProfile = {
          id: generateId('workspace'),
          companyName,
          niche,
          monthlyPlan,
          crm,
          createdAt: new Date().toISOString(),
        }
        set({ profile, managers: [], deals: [], activityLog: [], planFactHistory: [], tasks: [], onboardingComplete: true })
      },

      loadDemo: () => {
        const demo = buildDemoWorkspace()
        set({
          profile: demo.profile,
          managers: demo.managers,
          deals: demo.deals,
          activityLog: demo.activityLog,
          planFactHistory: demo.planFactHistory,
          tasks: demo.tasks,
          onboardingComplete: true,
        })
      },

      reset: () => {
        set({
          profile: null,
          managers: [],
          deals: [],
          activityLog: [],
          planFactHistory: [],
          tasks: [],
          onboardingComplete: false,
        })
      },

      addManager: (name) => {
        set((s) => ({ managers: [...s.managers, { id: generateId('mgr'), name, initials: initials(name) }] }))
      },

      updateMonthlyPlan: (value) => {
        set((s) => (s.profile ? { profile: { ...s.profile, monthlyPlan: value } } : s))
      },

      importDealsFromCsv: (rows) => {
        const state = get()
        const managers = [...state.managers]
        const createdManagers: string[] = []

        function resolveManagerId(name: string): string {
          const existing = managers.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase())
          if (existing) return existing.id
          const created: Manager = { id: generateId('mgr'), name, initials: initials(name) }
          managers.push(created)
          createdManagers.push(name)
          return created.id
        }

        const newDeals: Deal[] = rows.map((row) => {
          const createdAtISO = new Date(row.createdAt).toISOString()
          return {
            id: generateId('deal'),
            title: row.title,
            managerId: resolveManagerId(row.managerName),
            stage: row.outcome === 'won' ? 'won' : row.outcome === 'lost' ? 'lost' : row.stage,
            value: row.value,
            source: 'csv',
            createdAt: createdAtISO,
            stageEnteredAt: createdAtISO,
            stageHistory: [{ stage: row.stage, enteredAt: createdAtISO }],
            closedAt: row.outcome !== 'open' ? new Date().toISOString() : null,
            outcome: row.outcome,
            lostReason: row.lostReason,
            // CSV-импорт не несёт данных о следующем шаге/активности — РОП назначит их вручную.
            nextStep: null,
            lastActivityAt: createdAtISO,
          }
        })

        set((s) => ({ managers, deals: [...s.deals, ...newDeals] }))
        return { importedCount: newDeals.length, createdManagers }
      },

      createTask: ({ managerId, title, description = null, dealId = null, startDate = null, dueDate = null }) => {
        const task: Task = {
          id: generateId('task'),
          managerId,
          title,
          description,
          dealId,
          startDate,
          dueDate,
          status: 'new',
          createdAt: new Date().toISOString(),
          comments: [],
        }
        set((s) => ({ tasks: [task, ...s.tasks] }))
        return task
      },

      updateTaskStatus: (taskId, status) => {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }))
      },

      addComment: (taskId, text) => {
        const trimmed = text.trim()
        if (!trimmed) return
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, comments: [...t.comments, { id: generateId('comment'), author: 'owner', text: trimmed, createdAt: new Date().toISOString() }] }
              : t,
          ),
        }))
      },

      simulateManagerReply: (taskId) => {
        const state = get()
        const task = state.tasks.find((t) => t.id === taskId)
        if (!task) return
        const manager = state.managers.find((m) => m.id === task.managerId)
        const replyText = pickSimulatedManagerReply(task.id, task.comments.length)
        const comment = {
          id: generateId('comment'),
          author: manager?.name ?? 'Менеджер',
          text: replyText,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t)) }))
      },
    }),
    {
      name: 'ai-rop:state:v1',
      partialize: (s) => ({
        onboardingComplete: s.onboardingComplete,
        profile: s.profile,
        managers: s.managers,
        deals: s.deals,
        activityLog: s.activityLog,
        planFactHistory: s.planFactHistory,
        tasks: s.tasks,
      }),
    },
  ),
)

// hasHydrated нужно выставлять из onRehydrateStorage, но там нет доступа к set() напрямую —
// подписываемся на завершение гидратации через persist API вместо метода в самом стейте.
useSalesStore.persist.onFinishHydration(() => {
  useSalesStore.setState({ hasHydrated: true })
})
if (useSalesStore.persist.hasHydrated()) {
  useSalesStore.setState({ hasHydrated: true })
}
