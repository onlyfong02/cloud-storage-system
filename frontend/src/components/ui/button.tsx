import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-none text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50 cursor-pointer border-2 border-black shadow-nb active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    {
        variants: {
            variant: {
                default: "bg-[hsl(var(--primary))] text-black hover:bg-[hsl(var(--primary)/0.9)]",
                destructive: "bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive)/0.9)]",
                outline: "bg-white text-black hover:bg-[hsl(var(--accent))]",
                secondary: "bg-[hsl(var(--secondary))] text-black hover:bg-[hsl(var(--secondary)/0.8)]",
                ghost: "border-transparent shadow-none hover:bg-[hsl(var(--accent))] active:translate-x-0 active:translate-y-0",
                link: "border-none shadow-none text-black underline-offset-4 hover:underline active:translate-x-0 active:translate-y-0",
                success: "bg-[hsl(var(--success))] text-black hover:bg-[hsl(var(--success)/0.9)]",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 px-3",
                lg: "h-12 px-8 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
