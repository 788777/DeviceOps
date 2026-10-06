"""工单与工单评论 Schema."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.ticket import TicketPriority, TicketStatus
from app.schemas.device import DeviceBrief
from app.schemas.user import UserOut

# ==================== 工单评论 ====================


class TicketCommentBase(BaseModel):
    """评论公共字段."""

    content: str = Field(min_length=1, description="评论内容")


class TicketCommentCreate(TicketCommentBase):
    """创建评论请求体（user_id 由登录态注入）."""


class TicketCommentOut(TicketCommentBase):
    """评论响应体."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    user_id: int
    created_at: datetime
    user: Optional[UserOut] = None


# ==================== 工单 ====================


class TicketBase(BaseModel):
    """工单公共字段."""

    title: str = Field(
        min_length=1, max_length=200, description="工单标题", examples=["设备离线告警"]
    )
    description: Optional[str] = Field(default=None, description="问题描述")
    device_id: int = Field(description="关联设备 ID")
    assignee_id: Optional[int] = Field(default=None, description="负责人 ID")
    priority: TicketPriority = Field(
        default=TicketPriority.MEDIUM, description="优先级：low/medium/high/urgent"
    )


class TicketCreate(TicketBase):
    """创建工单请求体.

    creator_id 由登录态注入；status 不在请求体中，新建工单固定为 pending。
    """


class TicketUpdate(BaseModel):
    """更新工单请求体（全部可选）."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    device_id: Optional[int] = None
    assignee_id: Optional[int] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None


class TicketOut(TicketBase):
    """工单响应体."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    creator_id: int
    status: TicketStatus = Field(description="工单状态")
    created_at: datetime
    updated_at: datetime


class TicketDetail(TicketOut):
    """工单详情响应体（含设备/人员/评论）."""

    device: Optional[DeviceBrief] = None
    creator: Optional[UserOut] = None
    assignee: Optional[UserOut] = None
    comments: List[TicketCommentOut] = Field(default_factory=list)


class TicketAssignRequest(BaseModel):
    """指派工单请求体."""

    assignee_id: int = Field(description="负责人用户 ID")


class TicketStatusUpdate(BaseModel):
    """流转工单状态请求体."""

    status: TicketStatus = Field(
        description="目标状态，必须满足 pending -> processing -> resolved -> closed"
    )


class TicketPage(BaseModel):
    """工单分页响应体（用于接口文档描述）."""

    items: List[TicketOut] = Field(default_factory=list, description="当前页数据")
    total: int = Field(default=0, description="总记录数")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=10, description="每页数量")
    pages: int = Field(default=0, description="总页数")
