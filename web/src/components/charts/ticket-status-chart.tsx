"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART_COLORS, TICKET_STATUS_LABEL } from "@/lib/format";
import type { TicketsByStatusStats, TicketStatus } from "@/lib/types";

const STATUS_COLOR: Record<TicketStatus, string> = {
  pending: CHART_COLORS.amber,
  processing: CHART_COLORS.cyan,
  resolved: CHART_COLORS.emerald,
  closed: CHART_COLORS.slate,
};

export function TicketStatusChart({ stats }: { stats: TicketsByStatusStats }) {
  const data = React.useMemo(
    () =>
      stats.items.map((item) => ({
        status: TICKET_STATUS_LABEL[item.status],
        rawStatus: item.status,
        count: item.count,
        percentage: item.percentage,
      })),
    [stats],
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={44}
          tickMargin={4}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--accent) / 0.5)" }}
          content={<ChartTooltip />}
        />
        <Bar dataKey="count" name="工单数量" radius={[8, 8, 4, 4]} maxBarSize={54}>
          {data.map((entry) => (
            <Cell
              key={entry.rawStatus}
              fill={STATUS_COLOR[entry.rawStatus]}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
