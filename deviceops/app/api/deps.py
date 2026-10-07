"""API 公共依赖：数据库会话、当前用户、角色校验."""

from collections.abc import Callable, Generator
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import JWTError, decode_token
from app.crud.user import user as crud_user
from app.db.session import get_db
from app.models.user import User, UserRole

# Swagger /docs 上的 Authorize 按钮依赖它；tokenUrl 指向登录接口
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/token",
    auto_error=False,
)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="登录状态无效或已过期，请重新登录",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_db_session() -> Generator[Session, None, None]:
    """get_db 的显式别名，便于在接口中统一书写依赖名."""

    yield from get_db()


def get_pagination(
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """通用分页参数依赖：page 从 1 开始，page_size 限制在 1~100."""

    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    return {"page": page, "page_size": page_size, "offset": (page - 1) * page_size}


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """解析 Bearer token 并返回当前用户；失败统一抛 401."""

    if not token:
        raise CREDENTIALS_EXCEPTION

    try:
        payload = decode_token(token)
    except JWTError:
        raise CREDENTIALS_EXCEPTION

    subject = payload.get("sub")
    if not subject:
        raise CREDENTIALS_EXCEPTION

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise CREDENTIALS_EXCEPTION

    current_user = crud_user.get(db, user_id)
    if current_user is None:
        raise CREDENTIALS_EXCEPTION
    return current_user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """预留的"活跃用户"依赖（当前无禁用字段，直接返回当前用户）."""

    return current_user


def require_roles(*roles: UserRole) -> Callable[..., User]:
    """角色校验依赖工厂：require_roles(UserRole.ADMIN)."""

    allowed = set(roles)

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="权限不足，需要角色：" + "/".join(sorted(r.value for r in allowed)),
            )
        return current_user

    return dependency


# 常用快捷依赖
require_admin = require_roles(UserRole.ADMIN)
require_engineer = require_roles(UserRole.ADMIN, UserRole.ENGINEER)


__all__ = [
    "get_current_active_user",
    "get_current_user",
    "get_db",
    "get_db_session",
    "get_pagination",
    "oauth2_scheme",
    "require_admin",
    "require_engineer",
    "require_roles",
]
