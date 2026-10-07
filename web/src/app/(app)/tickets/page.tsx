"use client";

import * as React from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock4,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Ticket as TicketIcon,
  UserRound,
  XCircle,
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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { deviceApi, ticketApi, userApi } from "@/lib/endpoints";
import {
  TICKET_PRIORITY_LABEL,
  TICKET_PRIORITY_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  USER_ROLE_LABEL,
  formatDateTime,
  formatRelative,
  nextTicketStatus,
} from "@/lib/format";
import type { Ticket, TicketPriority, TicketStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: TicketStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待处理" },
  { value: "processing", label: "处理中" },
  { value: "resolved", label: "已解决" },
  { value: "closed", label: "已关闭" },
];

const PRIORITY_OPTIONS: { value: TicketPriority | "all"; label: string }[] = [
  { value: "all", label: "全部优先级" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
];

/** 状态流转按钮文案 */
const FLOW_ACTION_LABEL: Record<TicketStatus, string> = {
  pending: "重新打开",
  processing: "开始处理",
  resolved: "标记已解决",
  closed: "关闭工单",
};

export default function TicketsPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const canAssign = hasRole("admin", "engineer");

  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<TicketStatus | "all">("all");
  const [priority, setPriority] = React.useState<TicketPriority | "all">("all");
  const [flowPendingId, setFlowPendingId] = React.useState<number | null>(null);

  const queryKey = `tickets-${page}-${PAGE_SIZE}-${status}-${priority}`;
  const { data, error, loading, refreshing, refresh, setData } = useApiQuery(
    () => ticketApi.list({ page, size: PAGE_SIZE, status, priority }),
    queryKey,
  );

  const devicesQuery = useApiQuery(() => deviceApi.options(100), "tickets-devices");
  const usersQuery = useApiQuery(
    () => (isAdmin ? userApi.list({ page_size: 100 }) : Promise.resolve(null)),
    `tickets-users-${isAdmin}`,
  );

  const deviceMap = React.useMemo(() => {
    const map = new Map<number, string>();
    devicesQuery.data?.items.forEach((device) =>
      map.set(device.id, device.device_no),
    );
    return map;
  }, [devicesQuery.data]);

  const userMap = React.useMemo(() => {
    const map = new Map<number, string>();
    usersQuery.data?.items.forEach((item) =>
      map.set(item.id, item.username),
    );
    return map;
  }, [usersQuery.data]);

  /* ==================== 状态流转 ==================== */
  const { mutate: updateStatus } = useApiMutation(
    (id: number, next: TicketStatus) => ticketApi.updateStatus(id, next),
  );

  async function handleFlow(ticket: Ticket) {
    const next = nextTicketStatus(ticket.status);
    if (!next) return;
    setFlowPendingId(ticket.id);
    try {
      const updated = await updateStatus(ticket.id, next);
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
      toast.success(`工单 #${ticket.id} 已流转`, {
        description: `${TICKET_STATUS_LABEL[ticket.status]} → ${TICKET_STATUS_LABEL[next]}`,
      });
      if (status !== "all") refresh();
    } catch (err) {
      toast.error("状态流转失败", { description: getErrorMessage(err) });
    } finally {
      setFlowPendingId(null);
    }
  }

  /* ==================== 详情抽屉 ==================== */
  const [activeTicketId, setActiveTicketId] = React.useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [commentSubmitting, setCommentSubmitting] = React.useState(false);

  const detailQuery = useApiQuery(
    () =>
      activeTicketId
        ? ticketApi.detail(activeTicketId)
        : Promise.resolve(null),
    `ticket-detail-${activeTicketId}`,
  );

  function openDetail(ticketId: number) {
    setActiveTicketId(ticketId);
    setCommentText("");
    setSheetOpen(true);
  }

  async function handleAddComment() {
    if (!activeTicketId || !commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await ticketApi.addComment(activeTicketId, commentText.trim());
      setCommentText("");
      detailQuery.refresh();
      toast.success("评论已提交");
    } catch (err) {
      toast.error("评论失败", { description: getErrorMessage(err) });
    } finally {
      setCommentSubmitting(false);
    }
  }

  /* ==================== 新建工单 ==================== */
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newDeviceId, setNewDeviceId] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<TicketPriority>("medium");
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  async function handleCreateTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    if (!newTitle.trim()) {
      setCreateError("工单标题不能为空");
      return;
    }
    if (!newDeviceId) {
      setCreateError("请选择关联设备");
      return;
    }

    setCreating(true);
    try {
      await ticketApi.create({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        device_id: Number(newDeviceId),
        priority: newPriority,
      });
      toast.success("工单创建成功", { description: "新工单状态为「待处理」" });
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewDeviceId("");
      setNewPriority("medium");
      refresh();
    } catch (err) {
      const message = getErrorMessage(err);
      setCreateError(message);
      toast.error("创建失败", { description: message });
    } finally {
      setCreating(false);
    }
  }

  /* ==================== 指派 ==================== */
  const [assigneeInput, setAssigneeInput] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);

  async function handleAssign(assigneeId: number) {
    if (!activeTicketId) return;
    setAssigning(true);
    try {
      await ticketApi.assign(activeTicketId, assigneeId);
      toast.success("指派成功");
      detailQuery.refresh();
      refresh();
    } catch (err) {
      toast.error("指派失败", { description: getErrorMessage(err) });
    } finally {
      setAssigning(false);
    }
  }

  const items = data?.items ?? [];
  const detail = detailQuery.data;

  const canOperateDetail =
    !!detail &&
    !!user &&
    (isAdmin || (detail.assignee_id !== null && detail.assignee_id === user.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="工单管理"
        description="工单流转、指派与评论，数据来自 /api/v1/tickets"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              刷新
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              新建工单
            </Button>
          </>
        }
      />

      {/* 状态流程提示 */}
      <div className="surface-card flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">状态机：</span>
        {(["pending", "processing", "resolved", "closed"] as TicketStatus[]).map(
          (flowStatus, index, array) => (
            <React.Fragment key={flowStatus}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
                  TICKET_STATUS_TONE[flowStatus],
                )}
              >
                {TICKET_STATUS_LABEL[flowStatus]}
              </span>
              {index < array.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 opacity-60" />
              ) : null}
            </React.Fragment>
          ),
        )}
        <span className="ml-auto hidden sm:inline">
          仅工单负责人或管理员可流转（禁止跳级与回退）
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center">
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as TicketStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priority}
              onValueChange={(value) => {
                setPriority(value as TicketPriority | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="sm:ml-auto">
              <Badge variant="secondary" className="h-9 px-3 text-xs font-normal">
                共 {data?.total ?? 0} 个工单
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
              icon={<TicketIcon className="h-5 w-5" />}
              title="暂无工单"
              description={
                status !== "all" || priority !== "all"
                  ? "当前筛选条件下没有工单。"
                  : "还没有创建运维工单，点击「新建工单」开始。"
              }
              action={
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  新建工单
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>工单标题</TableHead>
                  <TableHead className="w-[110px]">优先级</TableHead>
                  <TableHead className="w-[110px]">状态</TableHead>
                  <TableHead className="w-[130px]">负责人</TableHead>
                  <TableHead className="w-[130px]">创建时间</TableHead>
                  <TableHead className="w-[150px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ticket) => {
                  const next = nextTicketStatus(ticket.status);
                  const allowed =
                    isAdmin ||
                    (ticket.assignee_id !== null && ticket.assignee_id === user?.id);
                  return (
                    <TableRow key={ticket.id} className="group">
                      <TableCell className="max-w-[320px]">
                        <button
                          type="button"
                          onClick={() => openDetail(ticket.id)}
                          className="block w-full text-left"
                        >
                          <p className="truncate font-medium transition-colors group-hover:text-primary">
                            {ticket.title}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            #{ticket.id} ·{" "}
                            {deviceMap.get(ticket.device_id) ??
                              `设备 #${ticket.device_id}`}
                          </p>
                        </button>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                            TICKET_PRIORITY_TONE[ticket.priority],
                          )}
                        >
                          {TICKET_PRIORITY_LABEL[ticket.priority]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                            TICKET_STATUS_TONE[ticket.status],
                          )}
                        >
                          {ticket.status === "closed" ? (
                            <XCircle className="h-3 w-3" />
                          ) : ticket.status === "resolved" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <CircleDashed className="h-3 w-3" />
                          )}
                          {TICKET_STATUS_LABEL[ticket.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {ticket.assignee_id ? (
                          <span className="flex items-center gap-1.5">
                            <UserRound className="h-3 w-3" />
                            {userMap.get(ticket.assignee_id) ??
                              `用户 #${ticket.assignee_id}`}
                          </span>
                        ) : (
                          <span className="italic opacity-70">未指派</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock4 className="h-3 w-3" />
                          {formatRelative(ticket.created_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {next ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => handleFlow(ticket)}
                              disabled={
                                !allowed || flowPendingId === ticket.id
                              }
                              title={
                                allowed
                                  ? undefined
                                  : "仅工单负责人或管理员可流转"
                              }
                            >
                              {flowPendingId === ticket.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ArrowRight className="h-3 w-3" />
                              )}
                              {FLOW_ACTION_LABEL[next]}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              已闭环
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openDetail(ticket.id)}
                            aria-label="查看详情"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
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

      {/* ==================== 工单详情抽屉 ==================== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex flex-col gap-0 overflow-y-auto scrollbar-thin p-0 sm:max-w-2xl">
          {detailQuery.loading || !detail ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="border-b border-border/60 p-6">
                <SheetHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">工单 #{detail.id}</Badge>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        TICKET_STATUS_TONE[detail.status],
                      )}
                    >
                      {TICKET_STATUS_LABEL[detail.status]}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        TICKET_PRIORITY_TONE[detail.priority],
                      )}
                    >
                      优先级：{TICKET_PRIORITY_LABEL[detail.priority]}
                    </span>
                  </div>
                  <SheetTitle className="text-xl">{detail.title}</SheetTitle>
                  <SheetDescription>
                    创建于 {formatDateTime(detail.created_at)} · 更新于{" "}
                    {formatDateTime(detail.updated_at)}
                  </SheetDescription>
                </SheetHeader>

                <p className="mt-4 whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/25 p-3 text-sm leading-relaxed text-muted-foreground">
                  {detail.description || "（无问题描述）"}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      关联设备
                    </p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {detail.device?.device_no ??
                        deviceMap.get(detail.device_id) ??
                        `设备 #${detail.device_id}`}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {detail.device?.model ?? "--"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      创建人
                    </p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {detail.creator?.username ?? `用户 #${detail.creator_id}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {detail.creator ? USER_ROLE_LABEL[detail.creator.role] : "--"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      负责人
                    </p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {detail.assignee?.username ??
                        (detail.assignee_id
                          ? `用户 #${detail.assignee_id}`
                          : "未指派")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {detail.assignee ? USER_ROLE_LABEL[detail.assignee.role] : "--"}
                    </p>
                  </div>
                </div>

                {/* 状态流转 */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {nextTicketStatus(detail.status) ? (
                    <Button
                      size="sm"
                      variant="gradient"
                      disabled={
                        !canOperateDetail || flowPendingId === detail.id
                      }
                      onClick={async () => {
                        await handleFlow(detail);
                        detailQuery.refresh();
                      }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      {FLOW_ACTION_LABEL[nextTicketStatus(detail.status)!]}
                    </Button>
                  ) : (
                    <Badge variant="muted">工单已闭环，无可用流转</Badge>
                  )}
                  {!canOperateDetail ? (
                    <span className="text-[11px] text-muted-foreground">
                      仅该工单负责人或管理员可流转状态
                    </span>
                  ) : null}
                </div>

                {/* 指派 */}
                {canAssign ? (
                  <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      指派 / 转派负责人
                    </p>
                    {isAdmin ? (
                      <Select
                        value={detail.assignee_id ? String(detail.assignee_id) : ""}
                        onValueChange={(value) => handleAssign(Number(value))}
                        disabled={assigning}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="选择用户" />
                        </SelectTrigger>
                        <SelectContent>
                          {usersQuery.data?.items.map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>
                              {item.username} · {USER_ROLE_LABEL[item.role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          placeholder="输入负责人用户 ID"
                          value={assigneeInput}
                          onChange={(event) => setAssigneeInput(event.target.value)}
                          className="h-8"
                          disabled={assigning}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!assigneeInput || assigning}
                          onClick={() => handleAssign(Number(assigneeInput))}
                        >
                          {assigning ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "指派"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* 评论 */}
              <div className="flex-1 space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">
                    处理记录（{detail.comments?.length ?? 0}）
                  </p>
                </div>

                {detail.comments?.length ? (
                  <div className="space-y-3">
                    {detail.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg border border-border/60 bg-muted/20 p-3"
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {comment.user?.username ?? `用户 #${comment.user_id}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateTime(comment.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                    暂无处理记录
                  </p>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="comment">添加处理记录</Label>
                  <Textarea
                    id="comment"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="记录排查过程、处理结论…（创建人、负责人或管理员可评论）"
                    disabled={commentSubmitting}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="gradient"
                      onClick={handleAddComment}
                      disabled={commentSubmitting || !commentText.trim()}
                    >
                      {commentSubmitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          提交中…
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          提交评论
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ==================== 新建工单 ==================== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建工单</DialogTitle>
            <DialogDescription>
              POST /api/v1/tickets —— 新工单状态固定为「待处理」，创建人为当前登录用户。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                工单标题 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="例如：DEV-1001 设备离线处理"
                disabled={creating}
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  关联设备 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={newDeviceId}
                  onValueChange={setNewDeviceId}
                  disabled={creating}
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
                <Label>优先级</Label>
                <Select
                  value={newPriority}
                  onValueChange={(value) =>
                    setNewPriority(value as TicketPriority)
                  }
                  disabled={creating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.filter((option) => option.value !== "all").map(
                      (option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">问题描述</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="描述故障现象、影响范围与期望处理方式…"
                disabled={creating}
              />
            </div>

            {createError ? (
              <p className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {createError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                取消
              </Button>
              <Button type="submit" variant="gradient" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    创建中…
                  </>
                ) : (
                  "创建工单"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
