"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronsUpDown, Radio } from "lucide-react";

import { NAV_ITEMS } from "@/components/layout/nav-config";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      <p className="px-3 pb-2 pt-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
        运维控制台
      </p>
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
              active
                ? "bg-sidebar-accent font-medium text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            {active ? (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-500" />
            ) : null}
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarFooter() {
  return (
    <div className="mt-auto space-y-3 px-4 pb-5">
      <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium">后端服务</span>
          <Badge variant="success" className="ml-auto px-2 py-0 text-[10px]">
            :8000
          </Badge>
        </div>
        <p className="mt-2 truncate text-[10px] text-muted-foreground">
          {API_BASE_URL}
        </p>
      </div>
      <p className="px-1 text-[10px] text-muted-foreground/70">
        DeviceOps Console v0.1.0
      </p>
    </div>
  );
}

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-2xl lg:flex",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 shadow-[0_8px_24px_-10px_rgba(99,102,241,0.9)]">
          <Radio className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">DeviceOps</p>
          <p className="text-[11px] text-muted-foreground">设备运维工单平台</p>
        </div>
        <ChevronsUpDown className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <SidebarNav />
      <SidebarFooter />
    </aside>
  );
}

/** 移动端抽屉内的侧边栏内容 */
export function MobileSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-sidebar-border pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500">
          <Radio className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">DeviceOps</p>
          <p className="text-[11px] text-muted-foreground">设备运维工单平台</p>
        </div>
      </div>
      <SidebarNav onNavigate={onNavigate} />
      <div className="mt-auto flex items-center gap-2 pt-4 text-[11px] text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        <span>{API_BASE_URL}</span>
      </div>
    </>
  );
}

