"""用户相关 Schema."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole

# ==================== 用户 ====================


class UserBase(BaseModel):
    """用户公共字段."""

    username: str = Field(
        min_length=3, max_length=50, description="登录用户名", examples=["admin"]
    )
    role: UserRole = Field(
        default=UserRole.VIEWER, description="角色：admin/engineer/viewer"
    )


class UserCreate(UserBase):
    """创建用户请求体."""

    password: str = Field(
        min_length=6, max_length=128, description="明文密码（服务端 bcrypt 加密）"
    )


class UserUpdate(BaseModel):
    """更新用户请求体（全部可选）."""

    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    role: Optional[UserRole] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)


class UserRoleUpdate(BaseModel):
    """修改用户角色请求体."""

    role: UserRole = Field(description="新角色：admin/engineer/viewer")


class UserOut(UserBase):
    """用户响应体（不含密码）."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class UserInDB(UserOut):
    """数据库中的用户（含密码哈希，仅内部使用）."""

    hashed_password: str


# ==================== 认证 ====================


class LoginRequest(BaseModel):
    """登录请求体（OAuth2 表单之外的 JSON 方式）."""

    username: str = Field(min_length=3, max_length=50, examples=["admin"])
    password: str = Field(min_length=6, max_length=128, examples=["admin123"])


class Token(BaseModel):
    """JWT 令牌响应体."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="有效期（秒）")


class TokenPayload(BaseModel):
    """JWT 载荷."""

    sub: Optional[str] = Field(default=None, description="用户标识，通常是 user id")
    username: Optional[str] = None
    role: Optional[UserRole] = None
    exp: Optional[int] = Field(default=None, description="过期时间戳")


# ==================== 操作日志 ====================


class OperationLogOut(BaseModel):
    """操作日志响应体."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    action: str
    target: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime
