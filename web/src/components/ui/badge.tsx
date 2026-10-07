import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        destructive:
          "border-red-500/25 bg-red-500/12 text-red-600 dark:text-red-300",
        success:
          "border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
        warning:
          "border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-300",
        info: "border-sky-500/25 bg-sky-500/12 text-sky-600 dark:text-sky-300",
        muted:
          "border-slate-500/25 bg-slate-500/12 text-slate-600 dark:text-slate-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** 左侧小圆点（状态标签常用） */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
