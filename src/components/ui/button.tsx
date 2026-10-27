import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-violet-300 disabled:pointer-events-none disabled:opacity-45 active:scale-[.98] cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-[#33203f] text-white hover:bg-[#51355f] shadow-sm',
        secondary: 'bg-[#e9e0f2] text-[#503066] hover:bg-[#ddd0eb]',
        outline: 'border border-[#e4e2df] bg-white hover:bg-[#f7f6f3] text-[#433c49]',
        ghost: 'hover:bg-[#f0edf2] text-[#635b6a]',
        lime: 'bg-[#e0efab] text-[#343c25] hover:bg-[#d4e990]',
        destructive: 'bg-red-50 text-red-700 hover:bg-red-100',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10 shrink-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
