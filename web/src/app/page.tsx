import { redirect } from "next/navigation";

/** 根路径直接进入仪表盘；未登录时由 (app) 布局重定向到 /login */
export default function HomePage() {
  redirect("/dashboard");
}
