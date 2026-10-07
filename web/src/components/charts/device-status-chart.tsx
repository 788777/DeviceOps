"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { CHART_COLORS } from "@/lib/format";
import type { DeviceStatusStats } from "@/lib/types";

export function DeviceStatusChart({ stats }: { stats: DeviceStatusStats }) {
  const data = React.useMemo(
    () =>
      [
        { name: "在线", value: stats.online, color: CHART_COLORS.emerald },
        { name: "离线", value: stats.offline, color: CHART_COLORS.slate },
        { name: "故障", value: stats.fault, color: CHART_COLORS.rose },
        { name: "维护中", value: stats.maintenance, color: CHART_COLORS.amber },
      ].filter((item) => item.value > 0),
    [stats],
  );

  const hasData = data.length > 0;

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Tooltip content={<ChartTooltip unit="台" />} />
          <Pie
            data={hasData ? data : [{ name: "暂无设备", value: 1, color: "hsl(var(--muted))" }]}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={hasData ? 3 : 0}
            stroke="transparent"
          >
            {(hasData
              ? data
              : [{ name: "暂无设备", value: 1, color: "hsl(var(--muted))" }]
            ).map((entry) => (
              <Cell key={entry.name} fill={entry.color} fillOpacity={0.9} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">
          {stats.total}
        </span>
        <span className="text-[11px] text-muted-foreground">设备总数</span>
      </div>
    </div>
  );
}
