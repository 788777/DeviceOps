"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, RefreshCw } from "lucide-react";

import { findNavItem } from "@/components/layout/nav-config";
import { MobileSidebarNav } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { USER_ROLE_LABEL } from "@/lib/format";

export function Header({ onRefresh }: { onRefresh?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navItem = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
      {/* 移动端菜单 */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="打开导航"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-[280px] flex-col border-r border-sidebar-border bg-sidebar/95 p-5 lg:hidden"
        >
          <MobileSidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold tracking-tight">
            {navItem?.label ?? "DeviceOps"}
          </h2>
          <Badge variant="outline" className="hidden sm:inline-flex">
            v0.1.0
          </Badge>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {navItem?.description ?? "设备运维工单管理系统"}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {onRefresh ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="text-muted-foreground hover:text-foreground"
            aria-label="刷新数据"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        ) : null}
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        {user ? (
          <div className="hidden items-center gap-2 lg:flex">
            <Badge variant="secondary" dot className="px-2">
              {USER_ROLE_LABEL[user.role]}
            </Badge>
          </div>
        ) : null}
        <UserMenu />
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="hidden gap-1.5 text-muted-foreground hover:text-foreground sm:inline-flex"
        >
          <LogOut className="h-3.5 w-3.5" />
          退出登录
        </Button>
      </div>
    </header>
  );
}
