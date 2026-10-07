"""设备告警模型."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import _enum_values

if TYPE_CHECKING:
    from app.models.device import Device


class AlertType(str, enum.Enum):
    """告警类型."""

    OFFLINE = "offline"          # 设备离线
    FAULT = "fault"              # 设备故障
    OVERSPEED = "overspeed"      # 超速
    LOW_BATTERY = "low_battery"  # 低电量
    OTHER = "other"              # 其他


class Alert(Base):
    """告警表."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    device_id: Mapped[int] = mapped_column(
        ForeignKey("devices.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
        comment="关联设备 ID",
    )
    type: Mapped[AlertType] = mapped_column(
        SAEnum(
            AlertType,
            name="alert_type",
            native_enum=False,
            length=20,
            values_callable=_enum_values,
        ),
        default=AlertType.OTHER,
        server_default=AlertType.OTHER.value,
        nullable=False,
        index=True,
        comment="告警类型：offline/fault/overspeed/low_battery/other",
    )
    content: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="告警内容"
    )
    is_false_positive: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="0",
        nullable=False,
        index=True,
        comment="是否误报",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True, comment="创建时间"
    )

    # ===== 关系 =====
    device: Mapped["Device"] = relationship("Device", back_populates="alerts")

    def __repr__(self) -> str:  # pragma: no cover - 调试用
        return f"<Alert id={self.id} device_id={self.device_id} type={self.type}>"
