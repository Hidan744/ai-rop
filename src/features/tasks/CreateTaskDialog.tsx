import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSalesStore } from '@/store/salesStore'

/**
 * Диалог постановки задачи менеджеру — переиспользуется на трёх экранах (карточка
 * рекомендации на Dashboard, страница «Менеджеры», страница «Задачи»), чтобы форма и логика
 * создания задачи жили в одном месте, а не дублировались в трёх местах UI.
 */
export function CreateTaskDialog({
  open,
  onOpenChange,
  initialManagerId,
  initialTitle,
  initialDealId = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialManagerId?: string | null
  initialTitle?: string
  initialDealId?: string | null
}) {
  const managers = useSalesStore((s) => s.managers)
  const createTask = useSalesStore((s) => s.createTask)

  const [managerId, setManagerId] = useState(initialManagerId ?? '')
  const [title, setTitle] = useState(initialTitle ?? '')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Пересобираем поля формы каждый раз при открытии — диалог общий для трёх мест вызова,
  // и предзаполнение должно соответствовать тому, что открыло его именно в этот раз.
  useEffect(() => {
    if (open) {
      setManagerId(initialManagerId ?? '')
      setTitle(initialTitle ?? '')
      setDescription('')
      setStartDate('')
      setDueDate('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!managerId || !title.trim()) return
    createTask({
      managerId,
      title: title.trim(),
      description: description.trim() || null,
      dealId: initialDealId,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    })
    onOpenChange(false)
  }

  const canSubmit = managerId.length > 0 && title.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Поставить задачу</DialogTitle>
            <DialogDescription>Задача попадёт в общий список на странице «Задачи» и в карточку менеджера.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-manager">Менеджер</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger id="task-manager"><SelectValue placeholder="Выберите менеджера" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-title">Задача</Label>
              <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-description">Комментарий (необязательно)</Label>
              <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Контекст задачи" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-start">Начало (необязательно)</Label>
                <Input
                  id="task-start"
                  type="datetime-local"
                  value={startDate}
                  max={dueDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Срок (необязательно)</Label>
                <Input
                  id="task-due"
                  type="datetime-local"
                  value={dueDate}
                  min={startDate || undefined}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button type="submit" disabled={!canSubmit}>Создать задачу</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
