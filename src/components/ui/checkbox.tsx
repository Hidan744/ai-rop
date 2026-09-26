import { forwardRef, type InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({ className, checked, ...props }, ref) => {
  return (
    <span className="relative inline-flex size-5 shrink-0">
      <input ref={ref} type="checkbox" checked={checked} className="peer absolute inset-0 size-5 cursor-pointer opacity-0" {...props} />
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-md border border-ink-600 bg-ink-900 transition-colors',
          'peer-checked:border-brand-500 peer-checked:bg-brand-500',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/50',
          className,
        )}
      >
        {checked && <Check className="size-3.5 text-ink-950" strokeWidth={3} />}
      </span>
    </span>
  )
})
Checkbox.displayName = 'Checkbox'
