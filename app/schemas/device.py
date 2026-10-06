"""设备相关 Schema."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.device import DeviceStatus


class DeviceBase(BaseModel):
    """设备公共字段."""

    device_no: str = Field(
        min_length=1, max_length=64, description="设备编号（唯一）", examples=["DEV-0001"]
    )
    model: str = Field(
        default="unknown", max_length=64, description="设备型号", examples=["GT06N"]
    )
    status: DeviceStatus = Field(default=DeviceStatus.OFFLINE, description="设备状态")
    location: Optional[str] = Field(
        default=None, max_length=255, description="安装位置/所属车辆"
    )
    last_online_at: Optional[datetime] = Field(default=None, description="最后在线时间")


class DeviceCreate(DeviceBase):
    """创建设备请求体."""


class DeviceUpdate(BaseModel):
    """更新设备请求体（全部可选）."""

    device_no: Optional[str] = Field(default=None, min_length=1, max_length=64)
    model: Optional[str] = Field(default=None, max_length=64)
    status: Optional[DeviceStatus] = None
    location: Optional[str] = Field(default=None, max_length=255)
    last_online_at: Optional[datetime] = None


class DeviceOut(DeviceBase):
    """设备响应体."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class DeviceBrief(BaseModel):
    """设备简要信息（用于工单/告警嵌套返回）."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    device_no: str
    model: str
    status: DeviceStatus
    location: Optional[str] = None


class DevicePage(BaseModel):
    """设备分页响应体（用于接口文档描述）."""

    items: List[DeviceOut] = Field(default_factory=list, description="当前页数据")
    total: int = Field(default=0, description="总记录数")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=10, description="每页数量")
    pages: int = Field(default=0, description="总页数")
