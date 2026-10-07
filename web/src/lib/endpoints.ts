"use client";

import { API_PREFIX, authStorage, request, toFormUrlEncoded } from "@/lib/api";
import type {
  Alert,
  AlertsTopStats,
  AlertPayload,
  AlertType,
  AuthUser,
  Device,
  DevicePayload,
  DeviceStatus,
  HealthInfo,
  LoginResult,
  OverviewStats,
  PageResult,
  PingInfo,
  Ticket,
  TicketComment,
  TicketDetail,
  TicketPayload,
  TicketPriority,
  TicketsByStatusStats,
  TicketStatus,
  UserRole,
} from "@/lib/types";

const v1 = (path: string) => `${API_PREFIX}${path}`;

/* ==================== 认证 ==================== */

export const authApi = {
  /** POST /api/v1/auth/login —— OAuth2 密码模式，表单提交 */
  async login(username: string, password: string): Promise<LoginResult> {
    const result = await request<LoginResult>({
      url: v1("/auth/login"),
      method: "POST",
      data: toFormUrlEncoded({ username, password }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    authStorage.setToken(result.access_token);
    authStorage.setUser(result.user);
    return result;
  },

  /** GET /api/v1/auth/me */
  me(): Promise<AuthUser> {
    return request<AuthUser>({ url: v1("/auth/me"), method: "GET" });
  },
};

/* ==================== 设备 ==================== */

export interface DeviceQuery {
  page?: number;
  size?: number;
  keyword?: string;
  status?: DeviceStatus | "all";
}

export const deviceApi = {
  list(query: DeviceQuery = {}): Promise<PageResult<Device>> {
    const { page = 1, size = 10, keyword, status } = query;
    return request<PageResult<Device>>({
      url: v1("/devices"),
      method: "GET",
      params: {
        page,
        size,
        ...(keyword ? { keyword } : {}),
        ...(status && status !== "all" ? { status } : {}),
      },
    });
  },
  create(payload: DevicePayload): Promise<Device> {
    return request<Device>({ url: v1("/devices"), method: "POST", data: payload });
  },
  update(id: number, payload: Partial<DevicePayload>): Promise<Device> {
    return request<Device>({
      url: v1(`/devices/${id}`),
      method: "PUT",
      data: payload,
    });
  },
  remove(id: number): Promise<{ id: number; device_no: string }> {
    return request<{ id: number; device_no: string }>({
      url: v1(`/devices/${id}`),
      method: "DELETE",
    });
  },
  /** 供下拉框使用：一次性拉取较多设备 */
  options(size = 100): Promise<PageResult<Device>> {
    return deviceApi.list({ page: 1, size });
  },
};

/* ==================== 告警 ==================== */

export interface AlertQuery {
  page?: number;
  size?: number;
  device_id?: number;
  type?: AlertType | "all";
  is_false_positive?: boolean;
}

export const alertApi = {
  list(query: AlertQuery = {}): Promise<PageResult<Alert>> {
    const { page = 1, size = 10, device_id, type, is_false_positive } = query;
    return request<PageResult<Alert>>({
      url: v1("/alerts"),
      method: "GET",
      params: {
        page,
        size,
        ...(device_id ? { device_id } : {}),
        ...(type && type !== "all" ? { type } : {}),
        ...(typeof is_false_positive === "boolean"
          ? { is_false_positive }
          : {}),
      },
    });
  },
  create(payload: AlertPayload): Promise<Alert> {
    return request<Alert>({ url: v1("/alerts"), method: "POST", data: payload });
  },
  markFalsePositive(id: number, isFalsePositive = true): Promise<Alert> {
    return request<Alert>({
      url: v1(`/alerts/${id}/false-positive`),
      method: "PATCH",
      data: { is_false_positive: isFalsePositive },
    });
  },
};

/* ==================== 工单 ==================== */

export interface TicketQuery {
  page?: number;
  size?: number;
  status?: TicketStatus | "all";
  priority?: TicketPriority | "all";
  assignee_id?: number;
  device_id?: number;
}

export const ticketApi = {
  list(query: TicketQuery = {}): Promise<PageResult<Ticket>> {
    const { page = 1, size = 10, status, priority, assignee_id, device_id } = query;
    return request<PageResult<Ticket>>({
      url: v1("/tickets"),
      method: "GET",
      params: {
        page,
        size,
        ...(status && status !== "all" ? { status } : {}),
        ...(priority && priority !== "all" ? { priority } : {}),
        ...(assignee_id ? { assignee_id } : {}),
        ...(device_id ? { device_id } : {}),
      },
    });
  },
  detail(id: number): Promise<TicketDetail> {
    return request<TicketDetail>({ url: v1(`/tickets/${id}`), method: "GET" });
  },
  create(payload: TicketPayload): Promise<Ticket> {
    return request<Ticket>({ url: v1("/tickets"), method: "POST", data: payload });
  },
  updateStatus(id: number, status: TicketStatus): Promise<Ticket> {
    return request<Ticket>({
      url: v1(`/tickets/${id}/status`),
      method: "PATCH",
      data: { status },
    });
  },
  assign(id: number, assigneeId: number): Promise<Ticket> {
    return request<Ticket>({
      url: v1(`/tickets/${id}/assign`),
      method: "PATCH",
      data: { assignee_id: assigneeId },
    });
  },
  comments(id: number, size = 50): Promise<PageResult<TicketComment>> {
    return request<PageResult<TicketComment>>({
      url: v1(`/tickets/${id}/comments`),
      method: "GET",
      params: { page: 1, size },
    });
  },
  addComment(id: number, content: string): Promise<TicketComment> {
    return request<TicketComment>({
      url: v1(`/tickets/${id}/comments`),
      method: "POST",
      data: { content },
    });
  },
};

/* ==================== 统计 ==================== */

export const statsApi = {
  overview(): Promise<OverviewStats> {
    return request<OverviewStats>({
      url: v1("/stats/overview"),
      method: "GET",
    });
  },
  ticketsByStatus(): Promise<TicketsByStatusStats> {
    return request<TicketsByStatusStats>({
      url: v1("/stats/tickets-by-status"),
      method: "GET",
    });
  },
  alertsTop(limit = 5, days?: number): Promise<AlertsTopStats> {
    return request<AlertsTopStats>({
      url: v1("/stats/alerts-top"),
      method: "GET",
      params: { limit, ...(days ? { days } : {}) },
    });
  },
};

/* ==================== 系统 ==================== */

export interface UserQuery {
  page?: number;
  page_size?: number;
  keyword?: string;
  role?: UserRole | "all";
}

export const userApi = {
  /** GET /api/v1/users —— 仅 admin 可访问 */
  list(query: UserQuery = {}): Promise<PageResult<AuthUser>> {
    const { page = 1, page_size = 100, keyword, role } = query;
    return request<PageResult<AuthUser>>({
      url: v1("/users"),
      method: "GET",
      params: {
        page,
        page_size,
        ...(keyword ? { keyword } : {}),
        ...(role && role !== "all" ? { role } : {}),
      },
    });
  },
  /** PATCH /api/v1/users/{id}/role —— 仅 admin 可访问 */
  updateRole(id: number, role: UserRole): Promise<AuthUser> {
    return request<AuthUser>({
      url: v1(`/users/${id}/role`),
      method: "PATCH",
      data: { role },
    });
  },
};

export const systemApi = {
  health(): Promise<HealthInfo> {
    return request<HealthInfo>({ url: "/health", method: "GET" });
  },
  ping(): Promise<PingInfo> {
    return request<PingInfo>({ url: v1("/ping"), method: "GET" });
  },
};
