"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BellRing,
  KeyRound,
  Loader2,
  Lock,
  Radio,
  ShieldCheck,
  Ticket,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL, authStorage } from "@/lib/api";
import { getErrorMessage } from "@/hooks/use-api";
import { Alert, AlertDescription } from "@/components/ui/alert";

const HIGHLIGHTS = [
  {
    icon: Activity,
    title: "实时运维看板",
    description: "设备在线率、告警与工单指标一屏掌握",
  },
  {
    icon: BellRing,
    title: "告警分级处置",
    description: "按类型分级展示，一键标记误报",
  },
  {
    icon: Ticket,
    title: "工单闭环流转",
    description: "待处理 → 处理中 → 已解决 → 已关闭",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user } = useAuth();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nextPath = searchParams.get("next") || "/dashboard";
  const expired = searchParams.get("reason") === "expired";

  // 已登录直接进入目标页
  React.useEffect(() => {
    if (user) router.replace(nextPath);
  }, [user, nextPath, router]);

  React.useEffect(() => {
    // 登录页不再持有旧 token，避免拦截器带着过期 token 请求
    if (expired) authStorage.clear();
  }, [expired]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setSubmitting(true);
    try {
      const logged = await login(username.trim(), password);
      toast.success(`欢迎回来，${logged.username}`, {
        description: "正在进入运维控制台…",
      });
      router.replace(nextPath);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error("登录失败", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="username"
            name="username"
            autoComplete="username"
            placeholder="请输入用户名"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 pl-9"
            disabled={submitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="请输入密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 pl-9"
            disabled={submitting}
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        variant="gradient"
        size="lg"
        className="h-11 w-full"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            正在登录…
          </>
        ) : (
          <>
            登录控制台
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">联调账号</span>
          <Badge variant="outline" className="ml-auto font-mono">
            admin / admin123
          </Badge>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          接口地址：<span className="font-mono">{API_BASE_URL}</span>
          <br />
          登录调用 <span className="font-mono">POST /api/v1/auth/login</span>
          （OAuth2 密码模式，JWT 保存在 localStorage）。
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* 背景光效 */}
      <div className="pointer-events-none absolute inset-0 aurora opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern bg-grid opacity-[0.15]" />

      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        {/* 左侧品牌区 */}
        <div className="hidden flex-col gap-8 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 shadow-[0_12px_36px_-14px_rgba(99,102,241,1)]">
              <Radio className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">DeviceOps</p>
              <p className="text-xs text-muted-foreground">设备运维工单管理系统</p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-snug tracking-tight">
              让设备运维的每一次告警与工单
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400 bg-clip-text text-transparent">
                都有迹可循
              </span>
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              对接 FastAPI 后端 <span className="font-mono">/api/v1</span>{" "}
              全套接口，覆盖设备台账、告警分级处置、工单状态机流转与运维指标看板。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="surface-card surface-card-hover p-4"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            JWT 鉴权 · 401 自动跳转登录 · 支持 admin / engineer / viewer 三种角色
          </div>
        </div>

        {/* 右侧登录卡片 */}
        <div className="surface-card hairline-top mx-auto w-full max-w-md p-7 sm:p-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">DeviceOps</p>
              <p className="text-[11px] text-muted-foreground">
                设备运维工单管理系统
              </p>
            </div>
          </div>

          <div className="mb-6 space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">登录控制台</h2>
            <p className="text-sm text-muted-foreground">
              使用后端账号登录，登录态由 JWT Token 承载。
            </p>
          </div>

          <React.Suspense
            fallback={
              <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中…
              </div>
            }
          >
            <LoginForm />
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}
