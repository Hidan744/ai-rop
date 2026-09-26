import { useEffect, useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSalesStore } from '@/store/salesStore'
import { checkAttachmentSize, formatAttachmentSize, type TaskAttachment } from '@/lib/sales/tasks'
import { generateId } from '@/lib/id'

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
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Пересобираем поля формы каждый раз при открытии — диалог общий для трёх мест вызова,
  // и предзаполнение должно соответствовать тому, что открыло его именно в этот раз.
  useEffect(() => {
    if (open) {
      setManagerId(initialManagerId ?? '')
      setTitle(initialTitle ?? '')
      setDescription('')
      setStartDate('')
      setDueDate('')
      setAttachments([])
      setAttachmentError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setAttachmentError(null)
    for (const file of Array.from(fileList)) {
      const error = checkAttachmentSize(file.size, attachments)
      if (error) {
        setAttachmentError(`«${file.name}»: ${error}`)
        continue
      }
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (!dataUrl) return
        setAttachments((prev) => [...prev, { id: generateId('file'), name: file.name, size: file.size, type: file.type, dataUrl }])
      }
      reader.readAsDataURL(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    setAttachmentError(null)
  }

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
      attachments,
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

            <div className="space-y-1.5">
              <Label>Файлы (необязательно)</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="size-3.5" />
                Прикрепить файл
              </Button>
              {attachmentError && <p className="text-xs text-negative-500">{attachmentError}</p>}
              {attachments.length > 0 && (
                <ul className="space-y-1.5 mt-1.5">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs">
                      <span className="truncate text-ink-200" title={a.name}>{a.name}</span>
                      <span className="flex items-center gap-2 shrink-0 text-ink-500">
                        {formatAttachmentSize(a.size)}
                        <button type="button" onClick={() => removeAttachment(a.id)} className="text-ink-500 hover:text-ink-100" aria-label={`Убрать ${a.name}`}>
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
