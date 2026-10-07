"""告警接口."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_engineer
from app.crud.alert import alert as crud_alert
from app.crud.device import device as crud_device
from app.models.alert import AlertType
from app.models.user import User
from app.schemas.alert import (
    AlertCreate,
    AlertFalsePositiveUpdate,
    AlertOut,
)
from app.utils.response import paginate, success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", summary="新增告警（engineer/admin）", response_model=None)
async def create_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_engineer),
) -> dict:
    """上报/录入一条设备告警."""

    if crud_device.get(db, payload.device_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="关联设备不存在"
        )

    alert_obj = crud_alert.create(db, payload)
    logger.info(
        "alert created: id=%s device_id=%s type=%s operator=%s",
        alert_obj.id,
        alert_obj.device_id,
        alert_obj.type.value,
        current_user.username,
    )
    return success(
        data=AlertOut.model_validate(alert_obj).model_dump(mode="json"),
        message="告警创建成功",
    )


@router.get("", summary="告警列表（分页/多条件过滤）", response_model=None)
async def list_alerts(
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    size: int = Query(default=10, ge=1, le=100, description="每页数量"),
    device_id: Optional[int] = Query(default=None, description="按设备过滤"),
    type_filter: Optional[AlertType] = Query(
        default=None, alias="type", description="按告警类型过滤"
    ),
    is_false_positive: Optional[bool] = Query(
        default=None, description="是否只看误报 / 只看有效告警"
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """分页查询告警，登录用户均可访问."""

    items, total = crud_alert.get_multi(
        db,
        offset=(page - 1) * size,
        limit=size,
        device_id=device_id,
        type=type_filter,
        is_false_positive=is_false_positive,
    )
    return paginate(
        items=[AlertOut.model_validate(item).model_dump(mode="json") for item in items],
        total=total,
        page=page,
        page_size=size,
    )


@router.patch("/{alert_id}/false-positive", summary="标记/取消误报（engineer/admin）", response_model=None)
async def mark_false_positive(
    alert_id: int,
    payload: AlertFalsePositiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_engineer),
) -> dict:
    """标记告警为误报（传 is_false_positive=false 可撤销）."""

    alert_obj = crud_alert.get(db, alert_id)
    if alert_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="告警不存在"
        )

    alert_obj = crud_alert.set_false_positive(
        db, alert_obj, payload.is_false_positive
    )
    logger.info(
        "alert false_positive updated: id=%s value=%s operator=%s",
        alert_obj.id,
        alert_obj.is_false_positive,
        current_user.username,
    )
    return success(
        data=AlertOut.model_validate(alert_obj).model_dump(mode="json"),
        message="误报标记已更新",
    )
