import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        success: "bg-success-soft text-success-foreground",
        info: "bg-accent text-accent-foreground",
        warning: "bg-warning-soft text-warning-foreground",
        destructive: "bg-destructive-soft text-destructive",
        neutral: "border border-border bg-card text-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

const dotVariants = cva("size-1.5 shrink-0 rounded-full", {
  variants: {
    variant: {
      success: "bg-success",
      info: "bg-primary",
      warning: "bg-warning",
      destructive: "bg-destructive",
      neutral: "bg-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

function Badge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot && <i aria-hidden="true" className={dotVariants({ variant })} />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
