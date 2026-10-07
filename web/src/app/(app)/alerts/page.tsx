"use client";

import * as React from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { alertApi, deviceApi, statsApi } from "@/lib/endpoints";
import {
  ALERT_SEVERITY,
  ALERT_SEVERITY_TONE,
  ALERT_TYPE_LABEL,
  formatDateTime,
  formatRelative,
} from "@/lib/format";
import type { AlertType } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const TYPE_OPTIONS: { value: AlertType | "all"; label: string }[] = [
  { value: "all", label: "全部类型" },
  { value: "offline", label: "设备离线" },
  { value: "fault", label: "设备故障" },
  { value: "overspeed", label: "超速告警" },
  { value: "low_battery", label: "低电量" },
  { value: "other", label: "其他" },
];

type FalsePositiveFilter = "all" | "effective" | "false";

export default function AlertsPage() {
  const { hasRole } = useAuth();
  const canHandle = hasRole("admin", "engineer");

  const [page, setPage] = React.useState(1);
  const [type, setType] = React.useState<AlertType | "all">("all");
  const [fpFilter, setFpFilter] = React.useState<FalsePositiveFilter>("all");
  const [pendingId, setPendingId] = React.useState<number | null>(null);

  const isFalsePositiveParam =
    fpFilter === "all" ? undefined : fpFilter === "false";

  const queryKey = `alerts-${page}-${PAGE_SIZE}-${type}-${fpFilter}`;
  const { data, error, loading, refreshing, refresh, setData } = useApiQuery(
    () =>
      alertApi.list({
        page,
        size: PAGE_SIZE,
        type,
        is_false_positive: isFalsePositiveParam,
      }),
    queryKey,
  );

  const overviewQuery = useApiQuery(() => statsApi.overview(), "alerts-overview");
  const devicesQuery = useApiQuery(() => deviceApi.options(100), "alerts-devices");

  const deviceNoMap = React.useMemo(() => {
    const map = new Map<number, string>();
    devicesQuery.data?.items.forEach((device) =>
      map.set(device.id, device.device_no),
    );
    return map;
  }, [devicesQuery.data]);

  /* ==================== 标记 / 撤销误报 ==================== */
  const { mutate: toggleFalsePositive } = useApiMutation(
    (id: number, next: boolean) => alertApi.markFalsePositive(id, next),
  );

  async function handleToggleFalsePositive(alertId: number, current: boolean) {
    const next = !current;
    setPendingId(alertId);
    try {
      const updated = await toggleFalsePositive(alertId, next);
      // 本地更新，避免整页重新拉取
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : prev,
      );
      toast.success(next ? "已标记为误报" : "已撤销误报标记", {
        description: `告警 #${alertId}`,
      });
      overviewQuery.refresh();
      if (fpFilter !== "all") refresh();
    } catch (err) {
      toast.error("操作失败", { description: getErrorMessage(err) });
    } finally {
      setPendingId(null);
    }
  }

  /* ==================== 上报告警 ==================== */
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formDeviceId, setFormDeviceId] = React.useState<string>("");
  const [formType, setFormType] = React.useState<AlertType>("other");
  const [formContent, setFormContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function handleCreateAlert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!formDeviceId) {
      setFormError("请选择关联设备");
      return;
    }

    setSubmitting(true);
    try {
      await alertApi.create({
        device_id: Number(formDeviceId),
        type: formType,
        content: formContent.trim() || null,
      });
      toast.success("告警已上报");
      setDialogOpen(false);
      setFormDeviceId("");
      setFormType("other");
      setFormContent("");
      refresh();
      overviewQuery.refresh();
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
      toast.error("上报失败", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  const items = data?.items ?? [];
  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="告警管理"
        description="设备告警列表与误报处理，数据来自 /api/v1/alerts"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refresh();
                overviewQuery.refresh();
              }}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              刷新
            </Button>
            {canHandle ? (
              <Button
                variant="gradient"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                上报告警
              </Button>
            ) : null}
          </>
        }
      />

      {/* 概览小卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "告警总数",
            value: overview?.alerts.total ?? 0,
            icon: BellRing,
            tone: "text-primary bg-primary/12",
          },
          {
            label: "有效告警",
            value: overview?.alerts.effective ?? 0,
            icon: ShieldAlert,
            tone: "text-rose-500 bg-rose-500/12",
          },
          {
            label: "已标记误报",
            value: overview?.alerts.false_positive ?? 0,
            icon: CheckCircle2,
            tone: "text-emerald-500 bg-emerald-500/12",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} interactive className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    item.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {item.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      条
                    </span>
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center">
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value as AlertType | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-[170px]">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={fpFilter}
              onValueChange={(value) => {
                setFpFilter(value as FalsePositiveFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部告警</SelectItem>
                <SelectItem value="effective">仅有效告警</SelectItem>
                <SelectItem value="false">仅误报</SelectItem>
              </SelectContent>
            </Select>

            <div className="sm:ml-auto">
              <Badge variant="secondary" className="h-9 px-3 text-xs font-normal">
                共 {data?.total ?? 0} 条告警
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <ErrorState message={error} onRetry={refresh} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<BellRing className="h-5 w-5" />}
              title="暂无告警"
              description={
                type !== "all" || fpFilter !== "all"
                  ? "当前筛选条件下没有告警记录。"
                  : "设备运行状态良好，尚未产生告警。"
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">级别</TableHead>
                  <TableHead className="w-[150px]">类型</TableHead>
                  <TableHead className="w-[150px]">来源设备</TableHead>
                  <TableHead>告警内容</TableHead>
                  <TableHead className="w-[110px]">状态</TableHead>
                  <TableHead className="w-[150px]">发生时间</TableHead>
                  {canHandle ? (
                    <TableHead className="w-[130px] text-right">操作</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((alert) => {
                  const severity = ALERT_SEVERITY[alert.type];
                  return (
                    <TableRow key={alert.id} className="group">
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                            ALERT_SEVERITY_TONE[severity.level],
                          )}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {severity.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {ALERT_TYPE_LABEL[alert.type]}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {deviceNoMap.get(alert.device_id) ??
                            `设备 #${alert.device_id}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          ID #{alert.id}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="truncate text-sm text-muted-foreground">
                          {alert.content || "--"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {alert.is_false_positive ? (
                          <Badge variant="muted" dot>
                            误报
                          </Badge>
                        ) : (
                          <Badge variant="destructive" dot>
                            生效中
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <p>{formatDateTime(alert.created_at)}</p>
                        <p className="text-[10px] opacity-70">
                          {formatRelative(alert.created_at)}
                        </p>
                      </TableCell>
                      {canHandle ? (
                        <TableCell className="text-right">
                          <Button
                            variant={
                              alert.is_false_positive ? "outline" : "secondary"
                            }
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              handleToggleFalsePositive(
                                alert.id,
                                alert.is_false_positive,
                              )
                            }
                            disabled={pendingId === alert.id}
                          >
                            {pendingId === alert.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : alert.is_false_positive ? (
                              <Undo2 className="h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            {alert.is_false_positive ? "撤销误报" : "标记误报"}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!loading && !error && items.length > 0 ? (
            <Pagination
              page={data?.page ?? 1}
              pages={data?.pages ?? 1}
              total={data?.total ?? 0}
              pageSize={data?.page_size ?? PAGE_SIZE}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* 上报告警 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>上报告警</DialogTitle>
            <DialogDescription>
              POST /api/v1/alerts —— 需要 engineer 或 admin 角色。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAlert} className="space-y-4">
            <div className="space-y-2">
              <Label>
                关联设备 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formDeviceId}
                onValueChange={setFormDeviceId}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择设备" />
                </SelectTrigger>
                <SelectContent>
                  {devicesQuery.data?.items.length ? (
                    devicesQuery.data.items.map((device) => (
                      <SelectItem key={device.id} value={String(device.id)}>
                        {device.device_no} · {device.model}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      暂无可选设备
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>告警类型</Label>
              <Select
                value={formType}
                onValueChange={(value) => setFormType(value as AlertType)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.filter((option) => option.value !== "all").map(
                    (option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">告警内容</Label>
              <Textarea
                id="content"
                value={formContent}
                onChange={(event) => setFormContent(event.target.value)}
                placeholder="例如：设备超过 30 分钟无定位上报"
                disabled={submitting}
              />
            </div>

            {formError ? (
              <p className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button type="submit" variant="gradient" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    提交中…
                  </>
                ) : (
                  "提交告警"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
