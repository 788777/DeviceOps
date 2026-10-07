"""统计服务：仪表盘总览、工单状态分布、告警 TOP."""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.device import Device, DeviceStatus
from app.models.ticket import Ticket, TicketStatus


def _rate(part: int, total: int) -> float:
    """计算百分比，保留两位小数；分母为 0 时返回 0.0."""

    if not total:
        return 0.0
    return round(part / total * 100, 2)


def _utc_now_naive() -> datetime:
    """当前 UTC 时间（去掉 tzinfo）.

    模型中的 created_at 由数据库 CURRENT_TIMESTAMP 生成，SQLite 下为 UTC 朴素时间，
    这里统一用同样的口径做时间过滤，避免时区错位。
    """

    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_device_stats(db: Session) -> dict[str, Any]:
    """设备统计：总数、各状态数量、在线率."""

    rows = db.execute(
        select(Device.status, func.count(Device.id)).group_by(Device.status)
    ).all()
    counts: dict[DeviceStatus, int] = {item: 0 for item in DeviceStatus}
    for status_value, count in rows:
        counts[status_value] = count

    total = sum(counts.values())
    online = counts[DeviceStatus.ONLINE]
    return {
        "total": total,
        "online": online,
        "offline": counts[DeviceStatus.OFFLINE],
        "fault": counts[DeviceStatus.FAULT],
        "maintenance": counts[DeviceStatus.MAINTENANCE],
        "online_rate": _rate(online, total),
    }


def get_ticket_status_stats(db: Session) -> dict[str, Any]:
    """工单统计：总数与各状态数量."""

    rows = db.execute(
        select(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status)
    ).all()
    counts: dict[TicketStatus, int] = {item: 0 for item in TicketStatus}
    for status_value, count in rows:
        counts[status_value] = count

    return {
        "total": sum(counts.values()),
        "pending": counts[TicketStatus.PENDING],
        "processing": counts[TicketStatus.PROCESSING],
        "resolved": counts[TicketStatus.RESOLVED],
        "closed": counts[TicketStatus.CLOSED],
    }


def get_alert_stats(db: Session) -> dict[str, Any]:
    """告警统计：总数、误报数、有效告警数."""

    total = db.execute(select(func.count()).select_from(Alert)).scalar_one()
    false_positive = db.execute(
        select(func.count())
        .select_from(Alert)
        .where(Alert.is_false_positive.is_(True))
    ).scalar_one()
    return {
        "total": total,
        "false_positive": false_positive,
        "effective": total - false_positive,
    }


def get_overview(db: Session) -> dict[str, Any]:
    """总览：设备 + 工单 + 告警."""

    return {
        "devices": get_device_stats(db),
        "tickets": get_ticket_status_stats(db),
        "alerts": get_alert_stats(db),
        "generated_at": _utc_now_naive(),
    }


def get_tickets_by_status(db: Session) -> dict[str, Any]:
    """工单状态分布（含每个状态占比）."""

    stats = get_ticket_status_stats(db)
    total = stats["total"]
    items = [
        {
            "status": status_value.value,
            "count": stats[status_value.value],
            "percentage": _rate(stats[status_value.value], total),
        }
        for status_value in TicketStatus
    ]
    return {"total": total, "items": items}


def get_alerts_top(
    db: Session,
    limit: int = 5,
    days: Optional[int] = None,
) -> dict[str, Any]:
    """告警 TOP：按设备聚合告警数量，降序返回前 limit 个."""

    count_expr = func.count(Alert.id)
    false_positive_expr = func.sum(
        case((Alert.is_false_positive.is_(True), 1), else_=0)
    )

    stmt = (
        select(
            Alert.device_id,
            Device.device_no,
            Device.model,
            count_expr.label("count"),
            false_positive_expr.label("false_positive_count"),
        )
        .join(Device, Device.id == Alert.device_id)
    )
    if days is not None:
        stmt = stmt.where(Alert.created_at >= _utc_now_naive() - timedelta(days=days))

    stmt = (
        stmt.group_by(Alert.device_id, Device.device_no, Device.model)
        .order_by(count_expr.desc(), Alert.device_id.asc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()

    items = []
    for device_id, device_no, model, count, false_positive_count in rows:
        false_positive_count = int(false_positive_count or 0)
        items.append(
            {
                "device_id": device_id,
                "device_no": device_no,
                "model": model,
                "count": int(count),
                "false_positive_count": false_positive_count,
                "effective_count": int(count) - false_positive_count,
            }
        )

    total_stmt = select(func.count()).select_from(Alert)
    if days is not None:
        total_stmt = total_stmt.where(
            Alert.created_at >= _utc_now_naive() - timedelta(days=days)
        )
    total_alerts = db.execute(total_stmt).scalar_one()

    return {"days": days, "total_alerts": total_alerts, "items": items}


__all__ = [
    "get_alert_stats",
    "get_alerts_top",
    "get_device_stats",
    "get_overview",
    "get_ticket_status_stats",
    "get_tickets_by_status",
]
