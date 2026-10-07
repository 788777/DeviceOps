import {
  BellRing,
  LayoutDashboard,
  MonitorSmartphone,
  Settings2,
  Ticket,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "概览仪表盘",
    description: "设备 / 告警 / 工单核心指标总览",
    icon: LayoutDashboard,
  },
  {
    href: "/devices",
    label: "设备管理",
    description: "设备台账、状态与新增维护",
    icon: MonitorSmartphone,
  },
  {
    href: "/alerts",
    label: "告警管理",
    description: "告警列表、级别与误报处理",
    icon: BellRing,
  },
  {
    href: "/tickets",
    label: "工单管理",
    description: "工单流转、指派与评论",
    icon: Ticket,
  },
  {
    href: "/settings",
    label: "系统设置",
    description: "外观偏好、账号与接口联调",
    icon: Settings2,
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
