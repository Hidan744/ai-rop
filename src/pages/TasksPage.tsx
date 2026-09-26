import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSalesStore } from '@/store/salesStore'
import { groupTasksByStatus, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@/lib/sales/tasks'
import { TaskCard } from '@/features/tasks/TaskCard'
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog'

export function TasksPage() {
  const tasks = useSalesStore((s) => s.tasks)
  const managers = useSalesStore((s) => s.managers)
  const deals = useSalesStore((s) => s.deals)
  const referenceISO = new Date().toISOString()

  const [searchParams, setSearchParams] = useSearchParams()
  const managerFilter = searchParams.get('manager')
  const [dialogOpen, setDialogOpen] = useState(false)

  const managerById = useMemo(() => new Map(managers.map((m) => [m.id, m])), [managers])
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals])

  const filteredTasks = managerFilter ? tasks.filter((t) => t.managerId === managerFilter) : tasks
  const groups = useMemo(() => groupTasksByStatus(filteredTasks, referenceISO), [filteredTasks, referenceISO])

  const filteredManagerName = managerFilter ? managerById.get(managerFilter)?.name : null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-50">Задачи</h1>
          <p className="text-sm text-ink-500 mt-1">Задачи менеджерам и обратная связь по ним — открытый тред комментариев на каждой задаче</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Новая задача
        </Button>
      </div>

      {filteredManagerName && (
        <div className="flex items-center gap-2 text-sm text-ink-300">
          Фильтр: <span className="text-ink-100 font-medium">{filteredManagerName}</span>
          <button
            type="button"
            onClick={() => setSearchParams((p) => { p.delete('manager'); return p })}
            className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-200 text-xs"
          >
            <X className="size-3.5" /> сбросить
          </button>
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-500">Задач пока нет — поставьте первую кнопкой выше.</Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4 items-start">
          {TASK_STATUS_ORDER.map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-400 px-1">
                {TASK_STATUS_LABELS[status]}
                <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] font-medium text-ink-300">{groups[status].length}</span>
              </div>
              <div className="space-y-3">
                {groups[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    manager={managerById.get(task.managerId)}
                    dealTitle={task.dealId ? (dealById.get(task.dealId)?.title ?? null) : null}
                    referenceISO={referenceISO}
                  />
                ))}
                {groups[status].length === 0 && <p className="text-xs text-ink-600 px-1">Нет задач в этой колонке</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} initialManagerId={managerFilter ?? undefined} />
    </div>
  )
}
