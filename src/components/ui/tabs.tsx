import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex items-center gap-1 rounded-xl bg-ink-900 border border-ink-800 p-1', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium text-ink-400 transition-colors data-[state=active]:bg-brand-500 data-[state=active]:text-ink-950 hover:text-ink-100',
        className,
      )}
      {...props}
    />
  )
}

export const TabsContent = TabsPrimitive.Content
