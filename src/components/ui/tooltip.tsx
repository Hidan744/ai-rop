import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider

export function InfoTooltip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn('inline-flex text-ink-400 hover:text-ink-200 transition-colors', className)}
          aria-label="Пояснение"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs leading-relaxed text-ink-100 shadow-xl animate-in fade-in-0 zoom-in-95"
        >
          {children}
          <TooltipPrimitive.Arrow className="fill-ink-800" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
