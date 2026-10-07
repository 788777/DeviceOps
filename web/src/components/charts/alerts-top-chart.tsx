"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART_COLORS } from "@/lib/format";
import type { AlertsTopStats } from "@/lib/types";

export function AlertsTopChart({ stats }: { stats: AlertsTopStats }) {
  const data = React.useMemo(
    () =>
      stats.items.map((item) => ({
        name: item.device_no,
        有效告警: item.effective_count,
        误报: item.false_positive_count,
      })),
    [stats],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
        暂无告警数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        barCategoryGap={12}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="hsl(var(--border))"
          horizontal={false}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={92}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--accent) / 0.5)" }}
          content={<ChartTooltip />}
        />
        <Bar
          dataKey="有效告警"
          stackId="alerts"
          fill={CHART_COLORS.primary}
          fillOpacity={0.85}
          radius={[0, 0, 0, 0]}
          maxBarSize={22}
        />
        <Bar
          dataKey="误报"
          stackId="alerts"
          fill={CHART_COLORS.amber}
          fillOpacity={0.7}
          radius={[0, 6, 6, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
