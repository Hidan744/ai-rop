import { useState } from 'react'
import { AlertTriangle, ClipboardPlus, Sparkles, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Recommendation } from '@/lib/sales/recommendations'
import { buildTaskTitleFromRecommendation } from '@/lib/sales/tasks'
import { CreateTaskDialog } from '@/features/tasks/CreateTaskDialog'

const SEVERITY_STYLES = {
  critical: { border: 'border-negative-500/30', bg: 'bg-negative-500/10', color: 'text-negative-500', Icon: XCircle, label: 'Критично' },
  warning: { border: 'border-warning-500/30', bg: 'bg-warning-500/10', color: 'text-warning-500', Icon: AlertTriangle, label: 'Внимание' },
  info: { border: 'border-brand-500/30', bg: 'bg-brand-500/10', color: 'text-brand-400', Icon: Sparkles, label: 'Возможность' },
} as const

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const style = SEVERITY_STYLES[recommendation.severity]
  const { Icon } = style
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Card className={cn('p-5 border', style.border)}>
      <div className="flex items-start gap-3.5">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', style.bg)}>
          <Icon className={cn('size-4.5', style.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-[11px] font-semibold uppercase tracking-wide mb-1.5', style.color)}>{style.label}</div>
          <p className="text-sm text-ink-100 leading-relaxed">{recommendation.sentence}</p>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <ClipboardPlus className="size-3.5" />
              Поставить задачу
            </Button>
          </div>
        </div>
      </div>

      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialManagerId={recommendation.managerId}
        initialTitle={buildTaskTitleFromRecommendation(recommendation)}
      />
    </Card>
  )
}
