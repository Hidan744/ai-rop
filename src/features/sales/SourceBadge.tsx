import { Database, GitBranch, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEAL_SOURCE_LABELS, type DealSource } from '@/types/sales'

const SOURCE_ICONS = {
  amocrm: Database,
  bitrix24: GitBranch,
  csv: Upload,
} as const

const SOURCE_STYLES: Record<DealSource, string> = {
  amocrm: 'text-aurora-blue-soft bg-aurora-blue/10 border-aurora-blue/25',
  bitrix24: 'text-positive-500 bg-positive-500/10 border-positive-500/25',
  csv: 'text-ink-400 bg-ink-800 border-ink-700',
}

export function SourceBadge({ source, className }: { source: DealSource; className?: string }) {
  const Icon = SOURCE_ICONS[source]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        SOURCE_STYLES[source],
        className,
      )}
    >
      <Icon className="size-3" />
      {DEAL_SOURCE_LABELS[source]}
    </span>
  )
}
