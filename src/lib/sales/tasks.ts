/**
 * Домен «Задачи и обратная связь» — задачи, которые РОП ставит менеджерам из рекомендаций,
 * карточки сделки или вручную, и открытый тред комментариев на задаче. В этом демо-продукте
 * (без реальных бэкенда/логинов менеджеров — см. бриф) именно тред комментариев ИГРАЕТ РОЛЬ
 * канала обратной связи: РОП пишет, видит (симулированный) ответ менеджера, отвечает снова.
 *
 * Как и в formulas.ts/recommendations.ts — здесь только чистые функции (факты, сортировка,
 * счётчики, шаблон симулированного ответа). CRUD и генерация id живут в сторе
 * (src/store/salesStore.ts).
 */
import type { Manager } from '@/types/sales'
import type { Recommendation } from './recommendations'

export type TaskStatus = 'new' | 'in_progress' | 'done'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
}

/** Порядок статусов для доски задач (страница «Задачи»). */
export const TASK_STATUS_ORDER: TaskStatus[] = ['new', 'in_progress', 'done']

export interface TaskComment {
  id: string
  /** 'owner' — сам РОП; иначе — имя менеджера (демо-сид или симулированный ответ). */
  author: string
  text: string
  createdAt: string
}

export interface Task {
  id: string
  managerId: string
  title: string
  description: string | null
  /** Сделка, к которой привязана задача — необязательно (задача может быть и без привязки к сделке). */
  dealId: string | null
  /** ISO-дата дедлайна — необязательна. */
  dueDate: string | null
  status: TaskStatus
  createdAt: string
  comments: TaskComment[]
}

/** Просрочена ли задача к моменту referenceISO — не выполнена и дедлайн уже прошёл. */
export function isTaskOverdue(task: Task, referenceISO: string): boolean {
  if (task.status === 'done' || !task.dueDate) return false
  return new Date(task.dueDate).getTime() < new Date(referenceISO).getTime()
}

/** Задача считается «открытой», пока не отмечена выполненной. */
export function isTaskOpen(task: Task): boolean {
  return task.status !== 'done'
}

export interface ManagerTaskSummary {
  managerId: string
  managerName: string
  openCount: number
  overdueCount: number
  doneCount: number
  totalCount: number
}

/** Сводка задач по каждому менеджеру — счётчики для бейджа на странице «Менеджеры». */
export function buildManagerTaskSummaries(tasks: Task[], managers: Manager[], referenceISO: string): ManagerTaskSummary[] {
  return managers.map((manager) => {
    const managerTasks = tasks.filter((t) => t.managerId === manager.id)
    return {
      managerId: manager.id,
      managerName: manager.name,
      openCount: managerTasks.filter(isTaskOpen).length,
      overdueCount: managerTasks.filter((t) => isTaskOverdue(t, referenceISO)).length,
      doneCount: managerTasks.filter((t) => t.status === 'done').length,
      totalCount: managerTasks.length,
    }
  })
}

/**
 * Сортировка списка задач: просроченные — первыми, затем по дедлайну (раньше — выше), задачи
 * без дедлайна — в конце своей группы, при равенстве — более новая задача выше.
 */
export function sortTasks(tasks: Task[], referenceISO: string): Task[] {
  return [...tasks].sort((a, b) => {
    const overdueA = isTaskOverdue(a, referenceISO) ? 0 : 1
    const overdueB = isTaskOverdue(b, referenceISO) ? 0 : 1
    if (overdueA !== overdueB) return overdueA - overdueB
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
    if (dueA !== dueB) return dueA - dueB
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

/** Группирует (отсортированные) задачи по статусу — основа доски на странице «Задачи». */
export function groupTasksByStatus(tasks: Task[], referenceISO: string): Record<TaskStatus, Task[]> {
  const sorted = sortTasks(tasks, referenceISO)
  const groups: Record<TaskStatus, Task[]> = { new: [], in_progress: [], done: [] }
  for (const task of sorted) groups[task.status].push(task)
  return groups
}

/**
 * Заголовок задачи из текста рекомендации — берём первое предложение (до точки), это и есть
 * ядро факта («Менеджер X завис на этапе Y по N сделкам»), а не весь совет целиком.
 */
export function buildTaskTitleFromRecommendation(recommendation: Pick<Recommendation, 'sentence'>): string {
  const sentence = recommendation.sentence.trim()
  const firstStop = sentence.indexOf('. ')
  const core = firstStop === -1 ? sentence.replace(/\.$/, '') : sentence.slice(0, firstStop)
  return core.endsWith('.') ? core : `${core}.`
}

// --- Симуляция ответа менеджера — это и есть «получать обратную связь» в демо-продукте без
// реального бэкенда: правдоподобный, но явно помеченный в UI как демо-приём канонический ответ. ---

const SIMULATED_REPLY_TEMPLATES: string[] = [
  'Принял, разберусь сегодня и отпишусь.',
  'Уже в работе — созвонился с клиентом, жду от него ответ по бюджету.',
  'Есть загвоздка: клиент попросил пересмотреть условия, нужна помощь со скидкой.',
  'Сделал, как договаривались, жду ответа от заказчика — держу в курсе.',
  'Можно сдвинуть срок? Клиент в отъезде до конца недели, раньше не получится.',
  'Готово, задача выполнена, двигаю сделку дальше по воронке.',
  'Клиент не берёт трубку третий день, планирую ещё одну попытку завтра утром.',
]

/**
 * Детерминированно подбирает следующий «ответ менеджера» по id задачи и количеству уже
 * существующих комментариев — тот же клик по той же задаче в том же состоянии треда всегда даёт
 * тот же текст, а повторные клики по мере роста треда дают разные ответы (не зацикливаются).
 */
export function pickSimulatedManagerReply(taskId: string, existingCommentCount: number): string {
  let hash = 0
  for (let i = 0; i < taskId.length; i++) {
    hash = (hash * 31 + taskId.charCodeAt(i)) | 0
  }
  const idx = (Math.abs(hash) + existingCommentCount) % SIMULATED_REPLY_TEMPLATES.length
  return SIMULATED_REPLY_TEMPLATES[idx]
}
