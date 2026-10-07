"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART_COLORS, formatShortDate, parseServerDate } from "@/lib/format";
import type { Alert } from "@/lib/types";

interface AlertTrendChartProps {
  alerts: Alert[];
  days?: number;
}

interface TrendPoint {
  date: string;
  effective: number;
  falsePositive: number;
}

/**
 * 后端 /stats/overview 未提供告警趋势序列，这里基于 /api/v1/alerts
 * 返回的明细在前端按天聚合出近 N 天趋势（最多使用最近 100 条明细）。
 */
export function buildAlertTrend(alerts: Alert[], days = 14): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    buckets.set(formatShortDate(day), {
      date: formatShortDate(day),
      effective: 0,
      falsePositive: 0,
    });
  }

  alerts.forEach((alert) => {
    const date = parseServerDate(alert.created_at);
    if (!date) return;
    const key = formatShortDate(date);
    const bucket = buckets.get(key);
    if (!bucket) return;
    if (alert.is_false_positive) {
      bucket.falsePositive += 1;
    } else {
      bucket.effective += 1;
    }
  });

  return Array.from(buckets.values());
}

export function AlertTrendChart({ alerts, days = 14 }: AlertTrendChartProps) {
  const data = React.useMemo(() => buildAlertTrend(alerts, days), [alerts, days]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="fillEffective" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.55} />
            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillFalsePositive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.45} />
            <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={44}
          tickMargin={4}
        />
        <Tooltip
          cursor={{ stroke: "hsl(var(--primary))", strokeDasharray: "4 4" }}
          content={<ChartTooltip />}
        />
        <Area
          type="monotone"
          dataKey="effective"
          name="有效告警"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          fill="url(#fillEffective)"
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="falsePositive"
          name="误报"
          stroke={CHART_COLORS.amber}
          strokeWidth={2}
          fill="url(#fillFalsePositive)"
          activeDot={{ r: 4, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
