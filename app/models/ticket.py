"""工单模型."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import _enum_values

if TYPE_CHECKING:
    from app.models.device import Device
    from app.models.ticket_comment import TicketComment
    from app.models.user import User


class TicketStatus(str, enum.Enum):
    """工单状态."""

    PENDING = "pending"        # 待处理
    PROCESSING = "processing"  # 处理中
    RESOLVED = "resolved"      # 已解决
    CLOSED = "closed"          # 已关闭


class TicketPriority(str, enum.Enum):
    """工单优先级."""

    LOW = "low"          # 低
    MEDIUM = "medium"    # 中
    HIGH = "high"        # 高
    URGENT = "urgent"    # 紧急


class Ticket(Base):
    """工单表."""

    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    title: Mapped[str] = mapped_column(
        String(200), index=True, nullable=False, comment="工单标题"
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="问题描述"
    )
    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="关联设备 ID",
    )
    creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="创建人 ID",
    )
    assignee_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="负责人 ID",
    )
    status: Mapped[TicketStatus] = mapped_column(
        SAEnum(
            TicketStatus,
            name="ticket_status",
            native_enum=False,
            length=20,
            values_callable=_enum_values,
        ),
        default=TicketStatus.PENDING,
        server_default=TicketStatus.PENDING.value,
        nullable=False,
        index=True,
        comment="状态：pending/processing/resolved/closed",
    )
    priority: Mapped[TicketPriority] = mapped_column(
        SAEnum(
            TicketPriority,
            name="ticket_priority",
            native_enum=False,
            length=20,
            values_callable=_enum_values,
        ),
        default=TicketPriority.MEDIUM,
        server_default=TicketPriority.MEDIUM.value,
        nullable=False,
        index=True,
        comment="优先级：low/medium/high/urgent",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="创建时间"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="更新时间",
    )

    # ===== 关系 =====
    device: Mapped["Device"] = relationship("Device", back_populates="tickets")
    creator: Mapped["User"] = relationship(
        "User", back_populates="created_tickets", foreign_keys=[creator_id]
    )
    assignee: Mapped[Optional["User"]] = relationship(
        "User", back_populates="assigned_tickets", foreign_keys=[assignee_id]
    )
    comments: Mapped[List["TicketComment"]] = relationship(
        "TicketComment",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="TicketComment.created_at",
    )

    def __repr__(self) -> str:  # pragma: no cover - 调试用
        return f"<Ticket id={self.id} title={self.title!r} status={self.status}>"
