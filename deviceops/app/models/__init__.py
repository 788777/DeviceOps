"""ORM 模型包.

在此统一导入全部模型，保证 Base.metadata 能发现所有表
（Base.metadata.create_all / Alembic autogenerate 都依赖这一点）。
"""

from app.models.alert import Alert, AlertType
from app.models.device import Device, DeviceStatus
from app.models.operation_log import OperationLog
from app.models.ticket import Ticket, TicketPriority, TicketStatus
from app.models.ticket_comment import TicketComment
from app.models.user import User, UserRole

__all__ = [
    "Alert",
    "AlertType",
    "Device",
    "DeviceStatus",
    "OperationLog",
    "Ticket",
    "TicketComment",
    "TicketPriority",
    "TicketStatus",
    "User",
    "UserRole",
]
