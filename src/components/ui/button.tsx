import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-ink-950 font-semibold hover:bg-brand-600 shadow-lg shadow-brand-500/20',
        secondary: 'bg-ink-800 text-ink-50 hover:bg-ink-700 border border-ink-700',
        ghost: 'text-ink-300 hover:text-ink-50 hover:bg-ink-800',
        outline: 'border border-ink-700 text-ink-100 hover:bg-ink-800',
        destructive: 'bg-negative-500/10 text-negative-500 hover:bg-negative-500/20 border border-negative-500/30',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  },
)
Button.displayName = 'Button'
