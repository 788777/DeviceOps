"""认证接口：注册、登录、当前用户."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, get_token_expire_seconds
from app.crud.user import user as crud_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut
from app.utils.response import success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user_obj: User) -> dict:
    """构造登录响应（统一响应格式，token 全部位于 data 中）."""

    token = create_access_token(
        subject=user_obj.id,
        extra_claims={"username": user_obj.username, "role": user_obj.role.value},
    )
    return success(
        data={
            "access_token": token,
            "token_type": "bearer",
            "expires_in": get_token_expire_seconds(),
            "user": UserOut.model_validate(user_obj).model_dump(mode="json"),
        },
        message="登录成功",
    )


@router.post("/register", summary="用户注册", response_model=None)
async def register(payload: UserCreate, db: Session = Depends(get_db)) -> dict:
    """注册新用户.

    说明：为便于初始化与联调，这里允许注册时指定角色；
    生产环境建议限定为 viewer，角色调整走管理员接口 PATCH /users/{id}/role。
    """

    if crud_user.get_by_username(db, payload.username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="用户名已存在"
        )

    user_obj = crud_user.create(db, payload)
    logger.info("user registered: id=%s username=%s role=%s", user_obj.id, user_obj.username, user_obj.role.value)
    return success(
        data=UserOut.model_validate(user_obj).model_dump(mode="json"),
        message="注册成功",
    )


@router.post("/login", summary="用户登录（OAuth2 密码模式）", response_model=None)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict:
    """使用 username/password 表单登录，返回 JWT（统一响应格式）."""

    user_obj = crud_user.authenticate(db, form_data.username, form_data.password)
    if user_obj is None:
        logger.warning("login failed for username=%s", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info("user login: id=%s username=%s", user_obj.id, user_obj.username)
    return _build_token_response(user_obj)


@router.post("/token", summary="OAuth2 标准令牌接口（仅供 /docs 使用）", response_model=None, include_in_schema=False)
async def oauth2_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict:
    """Swagger UI 的 Authorize 按钮依赖 OAuth2 标准响应结构.

    OAuth2 规范要求 access_token 位于响应根层级，而本项目业务接口统一使用
    {code, message, data}。为兼顾两者：业务登录走 /auth/login，Swagger UI 走这个
    不暴露在文档中的 /auth/token。
    """

    user_obj = crud_user.authenticate(db, form_data.username, form_data.password)
    if user_obj is None:
        logger.warning("oauth2 token failed for username=%s", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        subject=user_obj.id,
        extra_claims={"username": user_obj.username, "role": user_obj.role.value},
    )
    logger.info("oauth2 token issued: id=%s username=%s", user_obj.id, user_obj.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": get_token_expire_seconds(),
    }


@router.get("/me", summary="获取当前登录用户", response_model=None)
async def read_me(current_user: User = Depends(get_current_user)) -> dict:
    """返回当前 token 对应的用户信息."""

    return success(data=UserOut.model_validate(current_user).model_dump(mode="json"))
