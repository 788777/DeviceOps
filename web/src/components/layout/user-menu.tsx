"use client";

import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { USER_ROLE_LABEL, formatDate } from "@/lib/format";

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initial = user.username.slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-2 pr-3 text-left hover:bg-accent"
        >
          <Avatar className="h-8 w-8 border border-border/60">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="hidden flex-col items-start leading-tight sm:flex">
            <span className="text-sm font-medium">{user.username}</span>
            <span className="text-[11px] text-muted-foreground">
              {USER_ROLE_LABEL[user.role]}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>当前登录用户</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <Avatar className="h-9 w-9 border border-border/60">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium">{user.username}</p>
              <p className="text-[11px] text-muted-foreground">
                用户 ID #{user.id} · 注册于 {formatDate(user.created_at)}
              </p>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound className="h-4 w-4" />
          <span>个人资料</span>
          <span className="ml-auto text-[11px] text-muted-foreground">只读</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <ShieldCheck className="h-4 w-4" />
          <span>角色权限</span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {USER_ROLE_LABEL[user.role]}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={logout}>
          <LogOut className="h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
