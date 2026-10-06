"""设备管理接口."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_admin, require_engineer
from app.crud.device import device as crud_device
from app.models.device import DeviceStatus
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceOut, DeviceUpdate
from app.utils.response import paginate, success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", summary="设备列表（分页/搜索/状态过滤）", response_model=None)
async def list_devices(
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    size: int = Query(default=10, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(
        default=None, description="按设备编号或型号模糊搜索"
    ),
    status_filter: Optional[DeviceStatus] = Query(
        default=None, alias="status", description="按状态过滤：online/offline/fault/maintenance"
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """分页查询设备，登录用户均可访问."""

    items, total = crud_device.get_multi(
        db,
        offset=(page - 1) * size,
        limit=size,
        keyword=keyword,
        status=status_filter,
    )
    return paginate(
        items=[DeviceOut.model_validate(item).model_dump(mode="json") for item in items],
        total=total,
        page=page,
        page_size=size,
    )


@router.post("", summary="创建设备（engineer/admin）", response_model=None)
async def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_engineer),
) -> dict:
    """创建设备，设备编号唯一."""

    if crud_device.get_by_device_no(db, payload.device_no) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="设备编号已存在"
        )

    device_obj = crud_device.create(db, payload)
    logger.info(
        "device created: id=%s device_no=%s operator=%s",
        device_obj.id,
        device_obj.device_no,
        current_user.username,
    )
    return success(
        data=DeviceOut.model_validate(device_obj).model_dump(mode="json"),
        message="设备创建成功",
    )


@router.get("/{device_id}", summary="设备详情", response_model=None)
async def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """按 ID 查询设备详情，登录用户均可访问."""

    device_obj = crud_device.get(db, device_id)
    if device_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在"
        )
    return success(data=DeviceOut.model_validate(device_obj).model_dump(mode="json"))


@router.put("/{device_id}", summary="更新设备（engineer/admin）", response_model=None)
async def update_device(
    device_id: int,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_engineer),
) -> dict:
    """全量/部分更新设备信息（仅传入的字段会被修改）."""

    device_obj = crud_device.get(db, device_id)
    if device_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在"
        )

    # 修改设备编号时校验唯一性
    if payload.device_no and payload.device_no != device_obj.device_no:
        exists = crud_device.get_by_device_no(db, payload.device_no)
        if exists is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="设备编号已存在"
            )

    device_obj = crud_device.update(db, device_obj, payload)
    logger.info(
        "device updated: id=%s operator=%s fields=%s",
        device_obj.id,
        current_user.username,
        sorted(payload.model_dump(exclude_unset=True)),
    )
    return success(
        data=DeviceOut.model_validate(device_obj).model_dump(mode="json"),
        message="设备更新成功",
    )


@router.delete("/{device_id}", summary="删除设备（仅 admin）", response_model=None)
async def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    """删除设备，仅管理员可操作；关联的工单与告警会被一并删除."""

    device_obj = crud_device.get(db, device_id)
    if device_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在"
        )

    device_no = device_obj.device_no
    crud_device.delete(db, device_obj)
    logger.info(
        "device deleted: id=%s device_no=%s operator=%s",
        device_id,
        device_no,
        current_user.username,
    )
    return success(data={"id": device_id, "device_no": device_no}, message="设备删除成功")
