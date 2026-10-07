"use client";

import * as React from "react";
import {
  Cpu,
  Loader2,
  MapPin,
  MonitorSmartphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
import { Input } from "@/components/ui/input";
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
import { getErrorMessage, useApiQuery } from "@/hooks/use-api";
import { deviceApi } from "@/lib/endpoints";
import {
  DEVICE_STATUS_LABEL,
  DEVICE_STATUS_TONE,
  formatDateTime,
  formatLastOnline,
  formatRelative,
} from "@/lib/format";
import type { Device, DevicePayload, DeviceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: DeviceStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "online", label: "在线" },
  { value: "offline", label: "离线" },
  { value: "fault", label: "故障" },
  { value: "maintenance", label: "维护中" },
];

interface DeviceFormState {
  device_no: string;
  model: string;
  status: DeviceStatus;
  location: string;
}

const EMPTY_FORM: DeviceFormState = {
  device_no: "",
  model: "",
  status: "offline",
  location: "",
};

export default function DevicesPage() {
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin", "engineer");
  const canDelete = hasRole("admin");

  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<DeviceStatus | "all">("all");
  const [keywordInput, setKeywordInput] = React.useState("");
  const [keyword, setKeyword] = React.useState("");

  // 搜索防抖：输入停止 350ms 后再请求
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const queryKey = `devices-${page}-${PAGE_SIZE}-${status}-${keyword}`;
  const { data, error, loading, refreshing, refresh } = useApiQuery(
    () => deviceApi.list({ page, size: PAGE_SIZE, status, keyword }),
    queryKey,
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Device | null>(null);
  const [form, setForm] = React.useState<DeviceFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  function openCreateDialog() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(device: Device) {
    setEditing(device);
    setForm({
      device_no: device.device_no,
      model: device.model,
      status: device.status,
      location: device.location ?? "",
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!form.device_no.trim()) {
      setFormError("设备编号不能为空");
      return;
    }

    const payload: DevicePayload = {
      device_no: form.device_no.trim(),
      model: form.model.trim() || "unknown",
      status: form.status,
      location: form.location.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await deviceApi.update(editing.id, payload);
        toast.success("设备已更新", { description: payload.device_no });
      } else {
        await deviceApi.create(payload);
        toast.success("设备创建成功", { description: payload.device_no });
      }
      setDialogOpen(false);
      refresh();
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
      toast.error(editing ? "更新失败" : "创建失败", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(device: Device) {
    if (
      !window.confirm(
        `确认删除设备「${device.device_no}」？\n关联的工单与告警也会被一并删除，且不可恢复。`,
      )
    ) {
      return;
    }
    setDeletingId(device.id);
    try {
      await deviceApi.remove(device.id);
      toast.success("设备已删除", { description: device.device_no });
      refresh();
    } catch (err) {
      toast.error("删除失败", { description: getErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="设备管理"
        description="设备台账、运行状态与归属信息，数据来自 /api/v1/devices"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              刷新
            </Button>
            {canWrite ? (
              <Button variant="gradient" size="sm" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5" />
                新增设备
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {/* 工具栏 */}
          <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索设备编号或型号…"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as DeviceStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="sm:ml-auto">
              <Badge variant="secondary" className="h-9 px-3 text-xs font-normal">
                共 {data?.total ?? 0} 台设备
              </Badge>
            </div>
          </div>

          {/* 表格 */}
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
              icon={<MonitorSmartphone className="h-5 w-5" />}
              title="暂无设备"
              description={
                keyword || status !== "all"
                  ? "当前筛选条件下没有匹配的设备，试试调整搜索关键词或状态。"
                  : "还没有录入任何设备，点击「新增设备」开始建立台账。"
              }
              action={
                canWrite && !keyword && status === "all" ? (
                  <Button size="sm" variant="outline" onClick={openCreateDialog}>
                    <Plus className="h-3.5 w-3.5" />
                    新增设备
                  </Button>
                ) : null
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[220px]">设备编号</TableHead>
                  <TableHead className="w-[140px]">型号</TableHead>
                  <TableHead className="w-[120px]">状态</TableHead>
                  <TableHead>安装位置</TableHead>
                  <TableHead className="w-[150px]">最后在线</TableHead>
                  <TableHead className="w-[120px]">录入时间</TableHead>
                  {canWrite ? <TableHead className="w-[110px] text-right">操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((device) => (
                  <TableRow key={device.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground">
                          <Cpu className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{device.device_no}</p>
                          <p className="text-[11px] text-muted-foreground">
                            ID #{device.id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {device.model}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          DEVICE_STATUS_TONE[device.status],
                        )}
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          {device.status === "online" ? (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                          ) : null}
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                        {DEVICE_STATUS_LABEL[device.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{device.location || "--"}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatLastOnline(device.last_online_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <p>{formatDateTime(device.created_at)}</p>
                      <p className="text-[10px] opacity-70">
                        {formatRelative(device.created_at)}
                      </p>
                    </TableCell>
                    {canWrite ? (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(device)}
                            aria-label="编辑设备"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
                              onClick={() => handleDelete(device)}
                              disabled={deletingId === device.id}
                              aria-label="删除设备"
                            >
                              {deletingId === device.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
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

      {/* 新增 / 编辑设备 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑设备" : "新增设备"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `更新设备 ${editing.device_no} 的台账信息（PUT /api/v1/devices/${editing.id}）`
                : "录入一台新设备（POST /api/v1/devices），需要 engineer 或 admin 角色。"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="device_no">
                  设备编号 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="device_no"
                  value={form.device_no}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, device_no: event.target.value }))
                  }
                  placeholder="例如 DEV-1002"
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">设备型号</Label>
                <Input
                  id="model"
                  value={form.model}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, model: event.target.value }))
                  }
                  placeholder="例如 GT06N"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>设备状态</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value as DeviceStatus }))
                  }
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.filter((option) => option.value !== "all").map(
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
                <Label htmlFor="location">安装位置 / 车牌</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                  placeholder="例如 京A12345"
                  disabled={submitting}
                />
              </div>
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
                ) : editing ? (
                  "保存修改"
                ) : (
                  "创建设备"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
