"""统计相关 Schema（仪表盘 / 报表）."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.ticket import TicketStatus
from app.schemas.alert import AlertTopItem


class DeviceStatusStats(BaseModel):
    """设备状态统计."""

    total: int = Field(default=0, description="设备总数")
    online: int = Field(default=0, description="在线数")
    offline: int = Field(default=0, description="离线数")
    fault: int = Field(default=0, description="故障数")
    maintenance: int = Field(default=0, description="维护中数量")
    online_rate: float = Field(default=0.0, description="在线率（百分比，保留两位小数）")


class TicketStatusStats(BaseModel):
    """工单状态统计."""

    total: int = Field(default=0, description="工单总数")
    pending: int = Field(default=0, description="待处理")
    processing: int = Field(default=0, description="处理中")
    resolved: int = Field(default=0, description="已解决")
    closed: int = Field(default=0, description="已关闭")


class TicketPriorityStats(BaseModel):
    """工单优先级统计."""

    low: int = Field(default=0, description="低")
    medium: int = Field(default=0, description="中")
    high: int = Field(default=0, description="高")
    urgent: int = Field(default=0, description="紧急")


class AlertStats(BaseModel):
    """告警统计."""

    total: int = Field(default=0, description="告警总数")
    false_positive: int = Field(default=0, description="误报数")
    effective: int = Field(default=0, description="有效告警数（非误报）")


class TrendPoint(BaseModel):
    """趋势图单个数据点."""

    date: str = Field(description="日期，格式 YYYY-MM-DD")
    count: int = Field(default=0, description="数量")


class TrendSeries(BaseModel):
    """趋势图数据序列."""

    model_config = ConfigDict(from_attributes=True)

    items: List[TrendPoint] = Field(default_factory=list, description="按日期升序的数据点")


class DashboardStats(BaseModel):
    """仪表盘总览."""

    devices: DeviceStatusStats
    tickets: TicketStatusStats
    ticket_priority: TicketPriorityStats
    alerts: AlertStats
    ticket_trend: List[TrendPoint] = Field(
        default_factory=list, description="近 N 天工单创建趋势"
    )
    alert_trend: List[TrendPoint] = Field(
        default_factory=list, description="近 N 天告警趋势"
    )


class OverviewStats(BaseModel):
    """总览统计响应体."""

    devices: DeviceStatusStats
    tickets: TicketStatusStats
    alerts: AlertStats
    generated_at: datetime = Field(description="统计生成时间（UTC）")


class TicketStatusCount(BaseModel):
    """单个工单状态的分布."""

    status: TicketStatus = Field(description="工单状态")
    count: int = Field(default=0, description="数量")
    percentage: float = Field(default=0.0, description="占比（百分比）")


class TicketByStatusStats(BaseModel):
    """工单状态分布响应体."""

    total: int = Field(default=0, description="工单总数")
    items: List[TicketStatusCount] = Field(
        default_factory=list, description="按 pending/processing/resolved/closed 顺序"
    )


class AlertTopStats(BaseModel):
    """告警 TOP 响应体."""

    days: Optional[int] = Field(default=None, description="统计窗口天数，null 表示全部时间")
    total_alerts: int = Field(default=0, description="窗口内告警总数")
    items: List[AlertTopItem] = Field(default_factory=list, description="设备告警排行")
