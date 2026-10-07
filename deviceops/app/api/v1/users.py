"""用户管理接口（管理员）."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.crud.user import user as crud_user
from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserRoleUpdate
from app.utils.response import paginate, success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", summary="用户列表（admin）", response_model=None)
async def list_users(
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(default=None, description="用户名模糊搜索"),
    role: Optional[UserRole] = Query(default=None, description="按角色过滤"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """分页查询用户，仅管理员可访问."""

    items, total = crud_user.get_multi(
        db,
        offset=(page - 1) * page_size,
        limit=page_size,
        keyword=keyword,
        role=role,
    )
    return paginate(
        items=[UserOut.model_validate(item).model_dump(mode="json") for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{user_id}/role", summary="修改用户角色（admin）", response_model=None)
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    """修改指定用户角色，仅管理员可访问."""

    target = crud_user.get(db, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在"
        )
    if target.id == current_user.id and payload.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能取消自己的管理员角色",
        )

    target = crud_user.update_role(db, target, payload.role)
    logger.info(
        "role updated: operator=%s target=%s new_role=%s",
        current_user.username,
        target.username,
        target.role.value,
    )
    return success(
        data=UserOut.model_validate(target).model_dump(mode="json"),
        message="角色更新成功",
    )
