"""用户模型."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum as SAEnum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.operation_log import OperationLog
    from app.models.ticket import Ticket
    from app.models.ticket_comment import TicketComment


class UserRole(str, enum.Enum):
    """用户角色."""

    ADMIN = "admin"          # 管理员：全部权限
    ENGINEER = "engineer"    # 工程师：处理工单
    VIEWER = "viewer"        # 只读用户


def _enum_values(enum_cls: type[enum.Enum]) -> List[str]:
    """让数据库存储枚举的 value（如 admin），而不是成员名（ADMIN）."""

    return [member.value for member in enum_cls]


class User(Base):
    """用户表."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    username: Mapped[str] = mapped_column(
        String(50), unique=True, index=True, nullable=False, comment="登录用户名"
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="bcrypt 加密后的密码"
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            name="user_role",
            native_enum=False,
            length=20,
            values_callable=_enum_values,
        ),
        default=UserRole.VIEWER,
        server_default=UserRole.VIEWER.value,
        nullable=False,
        index=True,
        comment="角色：admin/engineer/viewer",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="创建时间"
    )

    # ===== 关系 =====
    created_tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        back_populates="creator",
        foreign_keys="Ticket.creator_id",
        cascade="all, delete-orphan",
    )
    assigned_tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        back_populates="assignee",
        foreign_keys="Ticket.assignee_id",
    )
    comments: Mapped[List["TicketComment"]] = relationship(
        "TicketComment",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    operation_logs: Mapped[List["OperationLog"]] = relationship(
        "OperationLog",
        back_populates="user",
    )

    def __repr__(self) -> str:  # pragma: no cover - 调试用
        return f"<User id={self.id} username={self.username!r} role={self.role}>"
