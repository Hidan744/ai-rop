import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { InfoTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  tooltip,
  accent = 'neutral',
  icon,
}: {
  label: string
  value: string
  tooltip: string
  accent?: 'positive' | 'negative' | 'neutral'
  icon?: ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-400">
          {label}
          <InfoTooltip>{tooltip}</InfoTooltip>
        </div>
        {icon}
      </div>
      <div
        className={cn(
          'font-display text-2xl font-bold tracking-tight',
          accent === 'positive' && 'text-positive-500',
          accent === 'negative' && 'text-negative-500',
          accent === 'neutral' && 'text-ink-50',
        )}
      >
        {value}
      </div>
    </Card>
  )
}
