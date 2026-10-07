"""安全模块：bcrypt 密码哈希与 JWT 生成/解析."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# passlib 1.7.4 在 bcrypt>=4.1 下读取 bcrypt.__about__ 会打一条 "(trapped) error reading
# bcrypt version" 的告警堆栈：只影响它展示后端版本号，不影响哈希与校验，这里压低避免误导。
logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)

# bcrypt 是 passlib 的默认推荐方案，deprecated="auto" 便于后续平滑升级算法
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt 算法本身只使用前 72 字节，显式截断可避免 bcrypt>=4 直接抛异常
_BCRYPT_MAX_BYTES = 72


def _prepare_password(password: str) -> bytes:
    """把明文密码转成 bcrypt 可接受的字节串（最多 72 字节）."""

    if not isinstance(password, str):
        raise TypeError("password must be a str")
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """生成 bcrypt 密码哈希."""

    return pwd_context.hash(_prepare_password(password))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """校验明文密码与哈希是否匹配（哈希非法时返回 False，不抛异常）."""

    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(_prepare_password(plain_password), hashed_password)
    except (ValueError, TypeError):
        return False


def create_access_token(
    subject: Union[str, int],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    """创建 JWT 访问令牌.

    :param subject: 令牌主体，通常为用户 ID
    :param expires_delta: 自定义有效期，默认读取 ACCESS_TOKEN_EXPIRE_MINUTES
    :param extra_claims: 需要附加到载荷的额外字段（如 username、role）
    """

    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """解析并校验 JWT；失败时抛出 jose.JWTError."""

    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def get_token_expire_seconds() -> int:
    """令牌有效期（秒）."""

    return settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


__all__ = [
    "JWTError",
    "create_access_token",
    "decode_token",
    "get_token_expire_seconds",
    "hash_password",
    "pwd_context",
    "verify_password",
]
