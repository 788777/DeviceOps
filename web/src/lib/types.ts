/**
 * 与后端 app/schemas/*.py 一一对应的类型定义。
 * 所有业务接口统一返回 { code, message, data }，code === 0 表示成功。
 */

/* ==================== 通用 ==================== */

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/* ==================== 用户 / 认证 ==================== */

export type UserRole = "admin" | "engineer" | "viewer";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

/* ==================== 设备 ==================== */

export type DeviceStatus = "online" | "offline" | "fault" | "maintenance";

export interface Device {
  id: number;
  device_no: string;
  model: string;
  status: DeviceStatus;
  location: string | null;
  last_online_at: string | null;
  created_at: string;
}

export interface DeviceBrief {
  id: number;
  device_no: string;
  model: string;
  status: DeviceStatus;
  location: string | null;
}

export interface DevicePayload {
  device_no: string;
  model?: string;
  status?: DeviceStatus;
  location?: string | null;
  last_online_at?: string | null;
}

/* ==================== 告警 ==================== */

export type AlertType =
  | "offline"
  | "fault"
  | "overspeed"
  | "low_battery"
  | "other";

export interface Alert {
  id: number;
  device_id: number;
  type: AlertType;
  content: string | null;
  is_false_positive: boolean;
  created_at: string;
}

export interface AlertPayload {
  device_id: number;
  type?: AlertType;
  content?: string | null;
}

/* ==================== 工单 ==================== */

export type TicketStatus = "pending" | "processing" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface Ticket {
  id: number;
  title: string;
  description: string | null;
  device_id: number;
  creator_id: number;
  assignee_id: number | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user?: AuthUser | null;
}

export interface TicketDetail extends Ticket {
  device?: DeviceBrief | null;
  creator?: AuthUser | null;
  assignee?: AuthUser | null;
  comments: TicketComment[];
}

export interface TicketPayload {
  title: string;
  description?: string | null;
  device_id: number;
  assignee_id?: number | null;
  priority?: TicketPriority;
}

/* ==================== 统计 ==================== */

export interface DeviceStatusStats {
  total: number;
  online: number;
  offline: number;
  fault: number;
  maintenance: number;
  online_rate: number;
}

export interface TicketStatusStats {
  total: number;
  pending: number;
  processing: number;
  resolved: number;
  closed: number;
}

export interface AlertStats {
  total: number;
  false_positive: number;
  effective: number;
}

export interface OverviewStats {
  devices: DeviceStatusStats;
  tickets: TicketStatusStats;
  alerts: AlertStats;
  generated_at: string;
}

export interface TicketStatusCount {
  status: TicketStatus;
  count: number;
  percentage: number;
}

export interface TicketsByStatusStats {
  total: number;
  items: TicketStatusCount[];
}

export interface AlertTopItem {
  device_id: number;
  device_no: string;
  model: string;
  count: number;
  false_positive_count: number;
  effective_count: number;
}

export interface AlertsTopStats {
  days: number | null;
  total_alerts: number;
  items: AlertTopItem[];
}

/* ==================== 系统 ==================== */

export interface HealthInfo {
  status: string;
  app: string;
  version: string;
  database: string;
}

export interface PingInfo {
  pong: boolean;
  app: string;
  version: string;
  prefix: string;
}
