import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useSalesStore } from '@/store/salesStore'
import { isTaskOverdue, TASK_STATUS_LABELS, TASK_STATUS_ORDER, type Task, type TaskStatus } from '@/lib/sales/tasks'
import type { Manager } from '@/types/sales'

const RELATIVE_FORMATTER = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const DUE_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

export function TaskCard({ task, manager, dealTitle, referenceISO }: { task: Task; manager: Manager | undefined; dealTitle: string | null; referenceISO: string }) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const updateTaskStatus = useSalesStore((s) => s.updateTaskStatus)
  const addComment = useSalesStore((s) => s.addComment)
  const simulateManagerReply = useSalesStore((s) => s.simulateManagerReply)

  const overdue = isTaskOverdue(task, referenceISO)

  function submitComment() {
    if (!draft.trim()) return
    addComment(task.id, draft)
    setDraft('')
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-medium text-ink-400">{manager?.name ?? 'Без менеджера'}</span>
            {dealTitle && <span className="text-[11px] rounded-full bg-ink-800 text-ink-400 px-2 py-0.5 truncate max-w-40" title={dealTitle}>{dealTitle}</span>}
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-500/10 px-2 py-0.5 text-[11px] font-medium text-warning-500">
                <span className="size-1.5 rounded-full bg-warning-500" aria-hidden />
                Просрочена
              </span>
            )}
          </div>
          <div className="text-sm text-ink-100 font-medium leading-snug">{task.title}</div>
          {task.description && <p className="text-xs text-ink-500 mt-1 leading-relaxed">{task.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-500">
            {task.dueDate && <span>Срок: {DUE_DATE_FORMATTER.format(new Date(task.dueDate))}</span>}
            <span>{task.comments.length} {task.comments.length === 1 ? 'комментарий' : 'комментария'}</span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <Select value={task.status} onValueChange={(v) => updateTaskStatus(task.id, v as TaskStatus)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? 'Свернуть' : 'Тред'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-ink-800 space-y-3">
          {task.comments.length === 0 && <p className="text-xs text-ink-500">Комментариев пока нет.</p>}
          {task.comments.map((c) => (
            <div key={c.id} className={cn('rounded-xl px-3 py-2 text-sm max-w-[85%]', c.author === 'owner' ? 'ml-auto bg-brand-500/10 text-ink-100' : 'bg-ink-800 text-ink-100')}>
              <div className="text-[11px] font-medium text-ink-400 mb-0.5">{c.author === 'owner' ? 'Вы (РОП)' : c.author}</div>
              {c.text}
              <div className="text-[10px] text-ink-500 mt-1">{RELATIVE_FORMATTER.format(new Date(c.createdAt))}</div>
            </div>
          ))}

          <div className="flex items-start gap-2 pt-1">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Написать менеджеру…"
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => simulateManagerReply(task.id)}
              title="Демо-приём: подставляет правдоподобный ответ менеджера, это не реальная интеграция"
            >
              <Sparkles className="size-3.5" />
              Симулировать ответ менеджера
            </Button>
            <Button size="sm" onClick={submitComment} disabled={!draft.trim()}>Отправить</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
