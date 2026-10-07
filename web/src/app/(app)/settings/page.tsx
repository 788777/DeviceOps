"use client";

import * as React from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Database,
  Loader2,
  Monitor,
  Moon,
  Palette,
  PlugZap,
  Radio,
  Server,
  ShieldCheck,
  Sun,
  UserRound,
  XCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/hooks/use-api";
import { API_BASE_URL, API_PREFIX } from "@/lib/api";
import { systemApi } from "@/lib/endpoints";
import { USER_ROLE_LABEL, formatDateTime } from "@/lib/format";
import type { HealthInfo, PingInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    value: "dark",
    label: "深色模式",
    description: "默认主题，适合长时间值守",
    icon: Moon,
  },
  {
    value: "light",
    label: "明亮模式",
    description: "高对比度，适合投屏演示",
    icon: Sun,
  },
  {
    value: "system",
    label: "跟随系统",
    description: "与操作系统外观保持一致",
    icon: Monitor,
  },
];

const PERMISSION_MATRIX: {
  action: string;
  roles: ("admin" | "engineer" | "viewer")[];
}[] = [
  { action: "查看设备 / 告警 / 工单 / 统计", roles: ["admin", "engineer", "viewer"] },
  { action: "创建设备、更新设备", roles: ["admin", "engineer"] },
  { action: "删除设备", roles: ["admin"] },
  { action: "上报告警、标记误报", roles: ["admin", "engineer"] },
  { action: "创建工单、新增评论", roles: ["admin", "engineer", "viewer"] },
  { action: "指派 / 转派工单", roles: ["admin", "engineer"] },
  { action: "流转工单状态", roles: ["admin"] },
  { action: "用户列表、修改角色", roles: ["admin"] },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  const [checking, setChecking] = React.useState(false);
  const [health, setHealth] = React.useState<HealthInfo | null>(null);
  const [ping, setPing] = React.useState<PingInfo | null>(null);
  const [checkError, setCheckError] = React.useState<string | null>(null);
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);

  const [compactTables, setCompactTables] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("deviceops.compactTables");
    setCompactTables(stored === "true");
  }, []);

  function toggleCompactTables(value: boolean) {
    setCompactTables(value);
    window.localStorage.setItem("deviceops.compactTables", String(value));
  }

  async function handleCheck() {
    setChecking(true);
    setCheckError(null);
    try {
      const [healthResult, pingResult] = await Promise.all([
        systemApi.health(),
        systemApi.ping(),
      ]);
      setHealth(healthResult);
      setPing(pingResult);
      setCheckedAt(new Date().toLocaleString("zh-CN"));
      toast.success("后端连通性正常", {
        description: `${healthResult.app} v${healthResult.version} · ${healthResult.database}`,
      });
    } catch (err) {
      const message = getErrorMessage(err);
      setCheckError(message);
      setHealth(null);
      setPing(null);
      setCheckedAt(new Date().toLocaleString("zh-CN"));
      toast.error("后端连接失败", { description: message });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统设置"
        description="外观偏好、账号信息与前后端联调状态"
        actions={
          <Button
            variant="gradient"
            size="sm"
            onClick={handleCheck}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlugZap className="h-3.5 w-3.5" />
            )}
            测试接口连通性
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ==================== 外观 ==================== */}
        <Card>
          <CardHeader className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              外观主题
            </CardTitle>
            <CardDescription>
              使用 next-themes 持久化到 localStorage，默认深色。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = mounted && theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all",
                      active
                        ? "border-primary/50 bg-primary/8 shadow-glow"
                        : "border-border/60 bg-muted/20 hover:border-primary/30 hover:bg-accent/50",
                    )}
                  >
                    <div className="flex w-full items-center gap-2">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {active ? (
                        <BadgeCheck className="ml-auto h-4 w-4 text-primary" />
                      ) : null}
                    </div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="compact">紧凑表格</Label>
                <p className="text-[11px] text-muted-foreground">
                  仅保存本地显示偏好，不影响后端数据。
                </p>
              </div>
              <Switch
                id="compact"
                checked={compactTables}
                onCheckedChange={toggleCompactTables}
              />
            </div>
          </CardContent>
        </Card>

        {/* ==================== 接口联调 ==================== */}
        <Card>
          <CardHeader className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-sky-400" />
              后端接口
            </CardTitle>
            <CardDescription>
              地址来自 <span className="font-mono">.env.local</span> 的
              NEXT_PUBLIC_API_BASE_URL。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">API Base URL</span>
                <span className="truncate font-mono">{API_BASE_URL}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">接口前缀</span>
                <span className="font-mono">{API_PREFIX}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">认证方式</span>
                <span className="font-mono">Authorization: Bearer &lt;JWT&gt;</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">401 处理</span>
                <span>清除 Token 并跳转登录页</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={health ? "success" : "outline"} dot>
                <Radio className="mr-0.5 h-3 w-3" />
                /health {health ? "正常" : "未检测"}
              </Badge>
              <Badge variant={ping ? "success" : "outline"} dot>
                <ShieldCheck className="mr-0.5 h-3 w-3" />
                {API_PREFIX}/ping {ping ? "正常" : "未检测"}
              </Badge>
              {health ? (
                <Badge variant="info" dot>
                  <Database className="mr-0.5 h-3 w-3" />
                  {health.database}
                </Badge>
              ) : null}
            </div>

            {health && ping ? (
              <div className="space-y-1 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-3 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  连通性检测通过
                </p>
                <p className="text-muted-foreground">
                  应用：{health.app} · 版本：{health.version} · 数据库：
                  {health.database}
                </p>
                <p className="text-muted-foreground">
                  API 版本：{ping.version} · 前缀：{ping.prefix}
                </p>
                {checkedAt ? (
                  <p className="text-muted-foreground">检测时间：{checkedAt}</p>
                ) : null}
              </div>
            ) : null}

            {checkError ? (
              <div className="space-y-1 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-3 text-xs">
                <p className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-300">
                  <XCircle className="h-3.5 w-3.5" />
                  连接失败
                </p>
                <p className="text-muted-foreground">{checkError}</p>
                <p className="text-muted-foreground">
                  请确认后端已在 {API_BASE_URL} 启动，且 CORS_ORIGINS 允许
                  http://localhost:3000。
                </p>
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCheck}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlugZap className="h-3.5 w-3.5" />
              )}
              重新检测
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ==================== 账号信息 ==================== */}
        <Card>
          <CardHeader className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-violet-400" />
              当前账号
            </CardTitle>
            <CardDescription>来自 /api/v1/auth/me</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-base font-semibold text-white">
                    {user.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-semibold">{user.username}</p>
                    <Badge variant="secondary" dot className="mt-1">
                      {USER_ROLE_LABEL[user.role]}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">用户 ID</dt>
                    <dd className="font-mono">#{user.id}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">角色标识</dt>
                    <dd className="font-mono">{user.role}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">注册时间</dt>
                    <dd>{formatDateTime(user.created_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Token 有效期</dt>
                    <dd>60 分钟（后端 ACCESS_TOKEN_EXPIRE_MINUTES）</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">未获取到账号信息</p>
            )}
          </CardContent>
        </Card>

        {/* ==================== 权限矩阵 ==================== */}
        <Card className="xl:col-span-2">
          <CardHeader className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              角色权限矩阵
            </CardTitle>
            <CardDescription>
              与后端 app/api/deps.py 中的 require_admin / require_engineer 保持一致。
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>操作</TableHead>
                  <TableHead className="w-[92px] text-center">admin</TableHead>
                  <TableHead className="w-[92px] text-center">engineer</TableHead>
                  <TableHead className="w-[92px] text-center">viewer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSION_MATRIX.map((row) => (
                  <TableRow key={row.action}>
                    <TableCell className="text-sm">{row.action}</TableCell>
                    {(["admin", "engineer", "viewer"] as const).map((role) => (
                      <TableCell key={role} className="text-center">
                        {row.roles.includes(role) ? (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ==================== 关于 ==================== */}
      <Card>
        <CardHeader className="space-y-1.5">
          <CardTitle>关于本控制台</CardTitle>
          <CardDescription>
            DeviceOps 前端（web/）独立于 FastAPI 后端（deviceops/）部署。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "框架", value: "Next.js 14 · App Router" },
              { label: "语言", value: "TypeScript" },
              { label: "样式", value: "Tailwind CSS + shadcn/ui" },
              { label: "图表", value: "Recharts" },
              { label: "图标", value: "Lucide React" },
              { label: "请求", value: "Axios（统一实例 + 拦截器）" },
              { label: "主题", value: "next-themes（默认深色）" },
              { label: "后端", value: "FastAPI · :8000 · /api/v1" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
