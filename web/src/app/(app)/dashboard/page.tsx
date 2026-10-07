"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  Clock4,
  Gauge,
  MonitorSmartphone,
  RefreshCw,
  Ticket as TicketIcon,
  TrendingUp,
} from "lucide-react";

import { AlertTrendChart } from "@/components/charts/alert-trend-chart";
import { AlertsTopChart } from "@/components/charts/alerts-top-chart";
import { DeviceStatusChart } from "@/components/charts/device-status-chart";
import { TicketStatusChart } from "@/components/charts/ticket-status-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/use-api";
import { alertApi, deviceApi, statsApi, ticketApi } from "@/lib/endpoints";
import {
  ALERT_SEVERITY,
  ALERT_SEVERITY_TONE,
  ALERT_TYPE_LABEL,
  CHART_COLORS,
  TICKET_PRIORITY_LABEL,
  TICKET_PRIORITY_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  formatDateTime,
  formatRelative,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/** 告警趋势窗口天数 */
const TREND_DAYS = 14;
/** 单页最大 100（后端 size <= 100） */
const TREND_SAMPLE_SIZE = 100;

export default function DashboardPage() {
  const overviewQuery = useApiQuery(() => statsApi.overview(), "overview");
  const ticketsByStatusQuery = useApiQuery(
    () => statsApi.ticketsByStatus(),
    "tickets-by-status",
  );
  const alertsTopQuery = useApiQuery(
    () => statsApi.alertsTop(5, 30),
    "alerts-top-30",
  );
  const alertsQuery = useApiQuery(
    () => alertApi.list({ page: 1, size: TREND_SAMPLE_SIZE }),
    `alerts-sample-${TREND_SAMPLE_SIZE}`,
  );
  const devicesQuery = useApiQuery(
    () => deviceApi.options(100),
    "devices-options",
  );
  const recentTicketsQuery = useApiQuery(
    () => ticketApi.list({ page: 1, size: 5 }),
    "recent-tickets",
  );

  const refreshing =
    overviewQuery.refreshing ||
    ticketsByStatusQuery.refreshing ||
    alertsTopQuery.refreshing ||
    alertsQuery.refreshing ||
    recentTicketsQuery.refreshing;

  const handleRefresh = React.useCallback(() => {
    overviewQuery.refresh();
    ticketsByStatusQuery.refresh();
    alertsTopQuery.refresh();
    alertsQuery.refresh();
    devicesQuery.refresh();
    recentTicketsQuery.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deviceNoMap = React.useMemo(() => {
    const map = new Map<number, string>();
    devicesQuery.data?.items.forEach((device) =>
      map.set(device.id, device.device_no),
    );
    return map;
  }, [devicesQuery.data]);

  const overview = overviewQuery.data;
  const alerts = alertsQuery.data?.items ?? [];
  const recentAlerts = alerts.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="概览仪表盘"
        description={
          overview
            ? `统计生成于 ${formatDateTime(overview.generated_at)}`
            : "设备、告警与工单核心指标实时总览"
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/alerts">
                <BellRing className="h-3.5 w-3.5" />
                处理告警
              </Link>
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              刷新数据
            </Button>
          </>
        }
      />

      {/* ==================== KPI 卡片 ==================== */}
      {overviewQuery.error && !overview ? (
        <ErrorState
          message={overviewQuery.error}
          onRetry={overviewQuery.refresh}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!overview
            ? Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="h-[132px] p-5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-4 h-8 w-20" />
                  <Skeleton className="mt-3 h-3 w-32" />
                </Card>
              ))
            : (
                <>
                  <StatCard
                    label="设备总数"
                    value={overview.devices.total}
                    unit="台"
                    icon={<MonitorSmartphone className="h-4 w-4" />}
                    accent="primary"
                    hint={`在线 ${overview.devices.online} · 故障 ${overview.devices.fault} · 维护 ${overview.devices.maintenance}`}
                  />
                  <StatCard
                    label="活跃告警"
                    value={overview.alerts.effective}
                    unit="条"
                    icon={<BellRing className="h-4 w-4" />}
                    accent="rose"
                    trend={{
                      value: `共 ${overview.alerts.total} 条`,
                      direction: overview.alerts.effective > 0 ? "up" : "flat",
                    }}
                    hint={`误报 ${overview.alerts.false_positive} 条`}
                  />
                  <StatCard
                    label="待处理工单"
                    value={overview.tickets.pending}
                    unit="个"
                    icon={<TicketIcon className="h-4 w-4" />}
                    accent="amber"
                    trend={{
                      value: `处理中 ${overview.tickets.processing}`,
                      direction: "flat",
                    }}
                    hint={`工单总数 ${overview.tickets.total} 个`}
                  />
                  <StatCard
                    label="设备在线率"
                    value={overview.devices.online_rate.toFixed(1)}
                    unit="%"
                    icon={<Gauge className="h-4 w-4" />}
                    accent="emerald"
                    trend={{
                      value: `${overview.devices.online}/${overview.devices.total} 在线`,
                      direction: overview.devices.online_rate >= 90 ? "up" : "down",
                    }}
                    hint={`离线 ${overview.devices.offline} 台`}
                  />
                </>
              )}
        </div>
      )}

      {/* ==================== 图表区 ==================== */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                告警趋势
              </CardTitle>
              <CardDescription>
                近 {TREND_DAYS} 天告警分布（按天聚合最近 {TREND_SAMPLE_SIZE} 条告警明细）
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3 pt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CHART_COLORS.primary }}
                />
                有效告警
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CHART_COLORS.amber }}
                />
                误报
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {alertsQuery.loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : alertsQuery.error ? (
              <ErrorState
                title="告警趋势加载失败"
                message={alertsQuery.error}
                onRetry={alertsQuery.refresh}
              />
            ) : (
              <AlertTrendChart alerts={alerts} days={TREND_DAYS} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              设备状态分布
            </CardTitle>
            <CardDescription>来自 /api/v1/stats/overview</CardDescription>
          </CardHeader>
          <CardContent>
            {overview ? (
              <>
                <DeviceStatusChart stats={overview.devices} />
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { label: "在线", value: overview.devices.online, color: CHART_COLORS.emerald },
                    { label: "离线", value: overview.devices.offline, color: CHART_COLORS.slate },
                    { label: "故障", value: overview.devices.fault, color: CHART_COLORS.rose },
                    { label: "维护中", value: overview.devices.maintenance, color: CHART_COLORS.amber },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/25 px-2 py-1.5"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="ml-auto font-medium tabular-nums">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Skeleton className="h-[300px] w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1.5">
            <CardTitle>工单状态分布</CardTitle>
            <CardDescription>来自 /api/v1/stats/tickets-by-status</CardDescription>
          </CardHeader>
          <CardContent>
            {ticketsByStatusQuery.loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : ticketsByStatusQuery.error ? (
              <ErrorState
                message={ticketsByStatusQuery.error}
                onRetry={ticketsByStatusQuery.refresh}
              />
            ) : ticketsByStatusQuery.data ? (
              <TicketStatusChart stats={ticketsByStatusQuery.data} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>告警 TOP 设备</CardTitle>
              <CardDescription>
                近 30 天告警数量排行 · /api/v1/stats/alerts-top
              </CardDescription>
            </div>
            {alertsTopQuery.data ? (
              <Badge variant="outline" className="shrink-0">
                共 {alertsTopQuery.data.total_alerts} 条
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {alertsTopQuery.loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : alertsTopQuery.error ? (
              <ErrorState
                message={alertsTopQuery.error}
                onRetry={alertsTopQuery.refresh}
              />
            ) : alertsTopQuery.data ? (
              <AlertsTopChart stats={alertsTopQuery.data} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ==================== 最近动态 ==================== */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>最近告警</CardTitle>
              <CardDescription>最新的 6 条告警记录</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/alerts">
                查看全部
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {alertsQuery.loading ? (
              <div className="space-y-2 px-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : recentAlerts.length === 0 ? (
              <EmptyState
                icon={<BellRing className="h-5 w-5" />}
                title="暂无告警"
                description="设备运行正常，没有产生新的告警记录。"
              />
            ) : (
              <div className="divide-y divide-border/60">
                {recentAlerts.map((alert) => {
                  const severity = ALERT_SEVERITY[alert.type];
                  return (
                    <div
                      key={alert.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          ALERT_SEVERITY_TONE[severity.level],
                        )}
                      >
                        <BellRing className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {ALERT_TYPE_LABEL[alert.type]}
                          </p>
                          <Badge
                            variant={
                              severity.level === "critical"
                                ? "destructive"
                                : severity.level === "warning"
                                  ? "warning"
                                  : "info"
                            }
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {severity.label}
                          </Badge>
                          {alert.is_false_positive ? (
                            <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
                              误报
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {deviceNoMap.get(alert.device_id) ?? `设备 #${alert.device_id}`}
                          {alert.content ? ` · ${alert.content}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatRelative(alert.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>最近工单</CardTitle>
              <CardDescription>按创建时间倒序展示最新 5 条</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/tickets">
                查看全部
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {recentTicketsQuery.loading ? (
              <div className="space-y-2 px-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : recentTicketsQuery.error ? (
              <div className="px-5">
                <ErrorState
                  message={recentTicketsQuery.error}
                  onRetry={recentTicketsQuery.refresh}
                />
              </div>
            ) : (recentTicketsQuery.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                icon={<TicketIcon className="h-5 w-5" />}
                title="暂无工单"
                description="还没有创建任何运维工单。"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>标题</TableHead>
                    <TableHead className="w-[90px]">优先级</TableHead>
                    <TableHead className="w-[96px]">状态</TableHead>
                    <TableHead className="w-[110px]">创建时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTicketsQuery.data?.items.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate font-medium">{ticket.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {deviceNoMap.get(ticket.device_id) ??
                            `设备 #${ticket.device_id}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
                            TICKET_PRIORITY_TONE[ticket.priority],
                          )}
                        >
                          {TICKET_PRIORITY_LABEL[ticket.priority]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
                            TICKET_STATUS_TONE[ticket.status],
                          )}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {TICKET_STATUS_LABEL[ticket.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock4 className="h-3 w-3" />
                          {formatRelative(ticket.created_at)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
