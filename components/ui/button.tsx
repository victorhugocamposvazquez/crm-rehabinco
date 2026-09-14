import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-dark",
        secondary:
          "border border-[var(--input)] bg-white text-foreground hover:border-accent hover:text-accent",
        ghost: "text-accent hover:bg-accent-soft",
        link: "text-accent underline-offset-4 hover:underline",
        floating: "rounded-full bg-accent text-white hover:bg-accent-dark",
      },
      size: {
        default: "h-9 rounded-[9px] px-3.5 text-[13.5px] min-[820px]:h-9 max-[819px]:h-10",
        sm: "h-8 rounded-[9px] px-3 text-[13px]",
        lg: "h-12 rounded-[9px] px-5 text-[15px]",
        icon: "h-9 w-9 rounded-[9px]",
        "icon-lg": "h-12 w-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const baseClassName = cn(buttonVariants({ variant, size, className }));

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ className?: string; ref?: React.Ref<unknown> }>, {
        className: cn(baseClassName, (children.props as { className?: string }).className),
        ref,
      });
    }

    return (
      <button className={baseClassName} ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
