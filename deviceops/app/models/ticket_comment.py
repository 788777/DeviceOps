"""工单评论模型."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.user import User


class TicketComment(Base):
    """工单评论表（处理记录/沟通内容）."""

    __tablename__ = "ticket_comments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="所属工单 ID",
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="评论人 ID",
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="评论内容")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="创建时间"
    )

    # ===== 关系 =====
    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="comments")
    user: Mapped["User"] = relationship("User", back_populates="comments")

    def __repr__(self) -> str:  # pragma: no cover - 调试用
        return f"<TicketComment id={self.id} ticket_id={self.ticket_id} user_id={self.user_id}>"
