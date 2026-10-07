import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
  icon: React.ReactNode;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  accent?: "primary" | "cyan" | "amber" | "rose" | "emerald";
  className?: string;
}

const ACCENT: Record<
  NonNullable<StatCardProps["accent"]>,
  { ring: string; icon: string; glow: string }
> = {
  primary: {
    ring: "from-indigo-500/25 to-violet-500/5",
    icon: "bg-indigo-500/12 text-indigo-500 dark:text-indigo-300",
    glow: "bg-indigo-500/12",
  },
  cyan: {
    ring: "from-sky-500/25 to-cyan-500/5",
    icon: "bg-sky-500/12 text-sky-500 dark:text-sky-300",
    glow: "bg-sky-500/12",
  },
  amber: {
    ring: "from-amber-500/25 to-orange-500/5",
    icon: "bg-amber-500/12 text-amber-500 dark:text-amber-300",
    glow: "bg-amber-500/12",
  },
  rose: {
    ring: "from-rose-500/25 to-red-500/5",
    icon: "bg-rose-500/12 text-rose-500 dark:text-rose-300",
    glow: "bg-rose-500/12",
  },
  emerald: {
    ring: "from-emerald-500/25 to-teal-500/5",
    icon: "bg-emerald-500/12 text-emerald-500 dark:text-emerald-300",
    glow: "bg-emerald-500/12",
  },
};

export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  trend,
  accent = "primary",
  className,
}: StatCardProps) {
  const tone = ACCENT[accent];
  return (
    <Card
      interactive
      className={cn("relative overflow-hidden p-5", className)}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl",
          tone.glow,
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="flex items-end gap-1.5">
            <span className="text-3xl font-semibold leading-none tracking-tight">
              {value}
            </span>
            {unit ? (
              <span className="pb-0.5 text-sm text-muted-foreground">{unit}</span>
            ) : null}
          </div>
          {trend ? (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                  trend.direction === "up"
                    ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
                    : trend.direction === "down"
                      ? "bg-rose-500/12 text-rose-600 dark:text-rose-300"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {trend.direction === "up" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : trend.direction === "down" ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : null}
                {trend.value}
              </span>
              {hint ? (
                <span className="text-[11px] text-muted-foreground">{hint}</span>
              ) : null}
            </div>
          ) : hint ? (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60",
            tone.icon,
          )}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
