"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers/auth-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  // 未登录 / token 失效时跳转登录页
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
          <p className="text-xs text-muted-foreground">正在验证登录状态…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 全局背景光效 */}
      <div className="pointer-events-none fixed inset-0 aurora opacity-40" />
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern bg-grid opacity-[0.04]" />

      <Sidebar />

      <div className="relative lg:pl-[264px]">
        <Header />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
          <div className="animate-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
