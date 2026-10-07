import type {
  AlertType,
  DeviceStatus,
  TicketPriority,
  TicketStatus,
  UserRole,
} from "@/lib/types";

/* ==================== 时间 ==================== */

/**
 * 后端返回的是「朴素时间字符串」（无时区）。容器化部署时 MySQL 已按
 * Asia/Shanghai 写入（docker-compose 里 default-time-zone=+08:00），
 * 因此这里按本地时间解析即可；若将来返回带时区的字符串也能兼容。
 */
export function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-10-06 16:40 */
export function formatDateTime(value?: string | null): string {
  const date = parseServerDate(value);
  if (!date) return "--";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 2026-10-06 */
export function formatDate(value?: string | null): string {
  const date = parseServerDate(value);
  if (!date) return "--";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

/** MM-DD，用于图表 X 轴 */
export function formatShortDate(value: Date): string {
  return `${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** 相对时间：刚刚 / 5 分钟前 / 3 小时前 / 2 天前 */
export function formatRelative(value?: string | null): string {
  const date = parseServerDate(value);
  if (!date) return "--";
  const diff = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  return formatDate(value);
}

/** 设备最后在线：yyyy-MM-dd HH:mm，空值显示「未知」 */
export function formatLastOnline(value?: string | null): string {
  return value ? formatDateTime(value) : "未知";
}

/* ==================== 枚举字典 ==================== */

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "在线",
  offline: "离线",
  fault: "故障",
  maintenance: "维护中",
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  offline: "设备离线",
  fault: "设备故障",
  overspeed: "超速告警",
  low_battery: "低电量",
  other: "其他",
};

/** 后端没有独立 severity 字段，按告警类型映射出「级别」用于展示 */
export const ALERT_SEVERITY: Record<
  AlertType,
  { level: "critical" | "warning" | "info"; label: string }
> = {
  offline: { level: "critical", label: "严重" },
  fault: { level: "critical", label: "严重" },
  overspeed: { level: "warning", label: "警告" },
  low_battery: { level: "warning", label: "警告" },
  other: { level: "info", label: "提示" },
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  resolved: "已解决",
  closed: "已关闭",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: "管理员",
  engineer: "工程师",
  viewer: "只读用户",
};

/** 工单状态机：pending -> processing -> resolved -> closed（禁止跳级与回退） */
export const TICKET_STATUS_FLOW: TicketStatus[] = [
  "pending",
  "processing",
  "resolved",
  "closed",
];

export function nextTicketStatus(current: TicketStatus): TicketStatus | null {
  const index = TICKET_STATUS_FLOW.indexOf(current);
  if (index < 0 || index >= TICKET_STATUS_FLOW.length - 1) return null;
  return TICKET_STATUS_FLOW[index + 1];
}

/* ==================== 状态标签配色 ==================== */

export const DEVICE_STATUS_TONE: Record<DeviceStatus, string> = {
  online:
    "border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  offline:
    "border-slate-500/25 bg-slate-500/12 text-slate-600 dark:text-slate-300",
  fault: "border-red-500/25 bg-red-500/12 text-red-600 dark:text-red-300",
  maintenance:
    "border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-300",
};

export const TICKET_STATUS_TONE: Record<TicketStatus, string> = {
  pending:
    "border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-300",
  processing: "border-sky-500/25 bg-sky-500/12 text-sky-600 dark:text-sky-300",
  resolved:
    "border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  closed: "border-slate-500/25 bg-slate-500/12 text-slate-500 dark:text-slate-400",
};

export const TICKET_PRIORITY_TONE: Record<TicketPriority, string> = {
  low: "border-slate-500/25 bg-slate-500/12 text-slate-600 dark:text-slate-300",
  medium: "border-sky-500/25 bg-sky-500/12 text-sky-600 dark:text-sky-300",
  high: "border-orange-500/25 bg-orange-500/12 text-orange-600 dark:text-orange-300",
  urgent: "border-red-500/25 bg-red-500/12 text-red-600 dark:text-red-300",
};

export const ALERT_SEVERITY_TONE: Record<
  "critical" | "warning" | "info",
  string
> = {
  critical: "border-red-500/25 bg-red-500/12 text-red-600 dark:text-red-300",
  warning:
    "border-amber-500/25 bg-amber-500/12 text-amber-600 dark:text-amber-300",
  info: "border-sky-500/25 bg-sky-500/12 text-sky-600 dark:text-sky-300",
};

/* ==================== 图表配色 ==================== */

export const CHART_COLORS = {
  primary: "hsl(239 84% 67%)",
  cyan: "hsl(189 94% 55%)",
  amber: "hsl(38 92% 56%)",
  rose: "hsl(350 89% 60%)",
  emerald: "hsl(152 62% 46%)",
  violet: "hsl(270 85% 66%)",
  slate: "hsl(217 15% 55%)",
};
