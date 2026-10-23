import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md font-heading text-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-face text-white shadow-[inset_0_-4px_0_0_var(--edge)] hover:bg-face-hi",
        destructive: "bg-face text-destructive shadow-[inset_0_-4px_0_0_var(--edge)] hover:bg-face-hi",
        ghost: "text-muted-foreground hover:bg-face hover:text-foreground",
        go: "bg-red text-white shadow-[inset_0_-4px_0_0_var(--edge)] hover:bg-red-hi disabled:bg-face disabled:text-faint disabled:opacity-100",
      },
      size: {
        default: "min-h-11 px-4 pb-1",
        icon: "size-11 pb-1",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
