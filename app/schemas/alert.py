"""告警相关 Schema."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.alert import AlertType
from app.schemas.device import DeviceBrief


class AlertBase(BaseModel):
    """告警公共字段."""

    device_id: int = Field(description="关联设备 ID")
    type: AlertType = Field(
        default=AlertType.OTHER,
        description="告警类型：offline/fault/overspeed/low_battery/other",
    )
    content: Optional[str] = Field(default=None, description="告警内容")


class AlertCreate(AlertBase):
    """创建告警请求体."""


class AlertUpdate(BaseModel):
    """更新告警请求体（全部可选）."""

    type: Optional[AlertType] = None
    content: Optional[str] = None
    is_false_positive: Optional[bool] = None


class AlertFalsePositiveUpdate(BaseModel):
    """标记误报请求体."""

    is_false_positive: bool = Field(default=True, description="是否误报")


class AlertOut(AlertBase):
    """告警响应体."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    is_false_positive: bool
    created_at: datetime


class AlertDetail(AlertOut):
    """告警详情响应体（含设备信息）."""

    device: Optional[DeviceBrief] = None


class AlertPage(BaseModel):
    """告警分页响应体（用于接口文档描述）."""

    items: List[AlertOut] = Field(default_factory=list, description="当前页数据")
    total: int = Field(default=0, description="总记录数")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=10, description="每页数量")
    pages: int = Field(default=0, description="总页数")


class AlertTopItem(BaseModel):
    """告警 TOP 单项：某设备的告警聚合."""

    device_id: int = Field(description="设备 ID")
    device_no: str = Field(description="设备编号")
    model: str = Field(description="设备型号")
    count: int = Field(default=0, description="告警总数")
    false_positive_count: int = Field(default=0, description="误报数")
    effective_count: int = Field(default=0, description="有效告警数")
