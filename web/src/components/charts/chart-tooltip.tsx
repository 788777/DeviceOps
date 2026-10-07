"use client";

import type { TooltipProps } from "recharts";

import { cn } from "@/lib/utils";

interface ChartTooltipProps extends TooltipProps<number, string> {
  /** 单位后缀，如「条」 */
  unit?: string;
  labelFormatter?: (label: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit = "条",
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 px-3 py-2 shadow-xl backdrop-blur-xl">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
        {labelFormatter ? labelFormatter(String(label)) : String(label)}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={`${entry.dataKey}`}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className={cn("h-2 w-2 rounded-full")}
              style={{ backgroundColor: entry.color ?? entry.stroke }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {Number(entry.value ?? 0).toLocaleString("zh-CN")} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
