"""操作日志模型."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class OperationLog(Base):
    """操作日志表（审计追踪）."""

    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="操作人 ID（系统操作可为空）",
    )
    action: Mapped[str] = mapped_column(
        String(50), index=True, nullable=False, comment="动作，如 create/update/delete/login"
    )
    target: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="操作对象，如 ticket:12"
    )
    detail: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="操作详情"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True, comment="创建时间"
    )

    # ===== 关系 =====
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="operation_logs"
    )

    def __repr__(self) -> str:  # pragma: no cover - 调试用
        return f"<OperationLog id={self.id} action={self.action!r} target={self.target!r}>"
