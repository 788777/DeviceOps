"""统计接口."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.stats import AlertTopStats, OverviewStats, TicketByStatusStats
from app.services import stats_service
from app.utils.response import success

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/overview", summary="总览统计（设备/工单/告警）", response_model=None)
async def overview(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """设备总数与在线率、工单状态分布、告警总数与有效告警数."""

    data = stats_service.get_overview(db)
    return success(data=OverviewStats.model_validate(data).model_dump(mode="json"))


@router.get("/tickets-by-status", summary="工单状态分布", response_model=None)
async def tickets_by_status(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """各状态工单数量与占比（pending/processing/resolved/closed）."""

    data = stats_service.get_tickets_by_status(db)
    return success(data=TicketByStatusStats.model_validate(data).model_dump(mode="json"))


@router.get("/alerts-top", summary="告警 TOP（按设备聚合）", response_model=None)
async def alerts_top(
    limit: int = Query(default=5, ge=1, le=50, description="返回条数"),
    days: Optional[int] = Query(
        default=None, ge=1, le=3650, description="只统计最近 N 天；不传表示全部时间"
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """告警数量最多的设备排行，含误报数与有效告警数."""

    data = stats_service.get_alerts_top(db, limit=limit, days=days)
    return success(data=AlertTopStats.model_validate(data).model_dump(mode="json"))
