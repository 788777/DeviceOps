"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { authStorage } from "@/lib/api";
import { authApi } from "@/lib/endpoints";
import type { AuthUser, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  // 首次挂载：先用本地缓存的用户信息快速渲染，再用 /auth/me 校验 token 是否有效
  React.useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const cached = authStorage.getUser();
    if (cached) setUser(cached);

    let cancelled = false;
    authApi
      .me()
      .then((fresh) => {
        if (cancelled) return;
        setUser(fresh);
        authStorage.setUser(fresh);
      })
      .catch(() => {
        // 401 已由 axios 拦截器统一处理（清 token + 跳登录）
        if (cancelled) return;
        authStorage.clear();
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = React.useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = React.useCallback(() => {
    authStorage.clear();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const refresh = React.useCallback(async () => {
    const fresh = await authApi.me();
    setUser(fresh);
    authStorage.setUser(fresh);
  }, []);

  const hasRole = React.useCallback(
    (...roles: UserRole[]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, refresh, hasRole }),
    [user, loading, login, logout, refresh, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 <AuthProvider> 内使用");
  }
  return context;
}
