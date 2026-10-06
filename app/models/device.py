"""设备模型."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum as SAEnum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import _enum_values

if TYPE_CHECKING:
    from app.models.alert import Alert
    from app.models.ticket import Ticket


class DeviceStatus(str, enum.Enum):
    """设备状态."""

    ONLINE = "online"            # 在线
    OFFLINE = "offline"          # 离线
    FAULT = "fault"              # 故障
    MAINTENANCE = "maintenance"  # 维护中


class Device(Base):
    """设备表（车载定位终端）."""

    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, comment="主键")
    device_no: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False, comment="设备编号（唯一）"
    )
    model: Mapped[str] = mapped_column(
        String(64), nullable=False, default="unknown", comment="设备型号"
    )
    status: Mapped[DeviceStatus] = mapped_column(
        SAEnum(
            DeviceStatus,
            name="device_status",
            native_enum=False,
            length=20,
            values_callable=_enum_values,
        ),
        default=DeviceStatus.OFFLINE,
        server_default=DeviceStatus.OFFLINE.value,
        nullable=False,
        index=True,
        comment="状态：online/offline/fault/maintenance",
    )
    location: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="安装位置/所属车辆"
    )
    last_online_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, comment="最后在线时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, comment="创建时间"
    )

    # ===== 关系 =====
    tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        back_populates="device",
        cascade="all, delete-orphan",
    )
    alerts: Mapped[List["Alert"]] = relationship(
        "Alert",
        back_populates="device",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover - 调试用
        return f"<Device id={self.id} device_no={self.device_no!r} status={self.status}>"
