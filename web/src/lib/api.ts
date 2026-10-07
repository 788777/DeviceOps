"use client";

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";

import type { ApiEnvelope, AuthUser } from "@/lib/types";

/** 后端地址，来自 web/.env.local 的 NEXT_PUBLIC_API_BASE_URL */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

/** 后端 v1 前缀（app/core/config.py: API_V1_PREFIX） */
export const API_PREFIX = "/api/v1";

const TOKEN_KEY = "deviceops.access_token";
const USER_KEY = "deviceops.user";

/* ==================== 统一错误对象 ==================== */

export class ApiError extends Error {
  readonly code: number;
  readonly status?: number;
  readonly data?: unknown;

  constructor(
    message: string,
    options: { code?: number; status?: number; data?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options.code ?? -1;
    this.status = options.status;
    this.data = options.data;
  }
}

/* ==================== Token / 用户信息存储 ==================== */

const canUseStorage = () => typeof window !== "undefined";

export const authStorage = {
  getToken(): string | null {
    if (!canUseStorage()) return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  getUser(): AuthUser | null {
    if (!canUseStorage()) return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  setUser(user: AuthUser) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};

/* ==================== Axios 实例 ==================== */

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

// 请求拦截器：自动附加 JWT Token
api.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  if (token) {
    config.headers.set?.("Authorization", `Bearer ${token}`);
  }
  return config;
});

const isAuthPath = (url?: string) =>
  !!url && (url.includes("/auth/login") || url.includes("/auth/token"));

// 响应拦截器：统一处理 401 未授权
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url;

    if (status === 401 && !isAuthPath(requestUrl)) {
      authStorage.clear();
      if (canUseStorage() && !window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.replace(`/login?next=${next}&reason=expired`);
      }
    }

    const payload = error.response?.data;
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as ApiEnvelope<unknown>).message)
        : undefined) ||
      error.message ||
      "网络请求失败，请确认后端服务已启动";

    return Promise.reject(
      new ApiError(message, {
        code:
          payload && typeof payload === "object" && "code" in payload
            ? Number((payload as ApiEnvelope<unknown>).code)
            : (status ?? -1),
        status,
        data:
          payload && typeof payload === "object" && "data" in payload
            ? (payload as ApiEnvelope<unknown>).data
            : undefined,
      }),
    );
  },
);

/* ==================== 统一请求方法（自动解包 data） ==================== */

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request<ApiEnvelope<T>>(config);
  const body = response.data as unknown;

  if (body && typeof body === "object" && "code" in body && "data" in body) {
    const envelope = body as ApiEnvelope<T>;
    if (envelope.code !== 0) {
      throw new ApiError(envelope.message || "请求失败", {
        code: envelope.code,
        status: response.status,
        data: envelope.data,
      });
    }
    return envelope.data;
  }

  // 非统一格式（例如 /auth/token）原样返回
  return body as T;
}

/** 把对象转成后端 OAuth2PasswordRequestForm 需要的 x-www-form-urlencoded */
export function toFormUrlEncoded(data: Record<string, string>) {
  return new URLSearchParams(data).toString();
}
