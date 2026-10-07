"""API v1 路由聚合器.

后续阶段的业务路由（auth/users/devices/tickets/...）都通过 include_router
挂载到 api_router 上，main.py 只需注册一次。
"""

from fastapi import APIRouter

from app.api.v1 import alerts, auth, devices, stats, tickets, users
from app.core.config import settings
from app.utils.response import success

api_router = APIRouter()

# 认证 / 用户模块
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(devices.router)
api_router.include_router(tickets.router)
api_router.include_router(alerts.router)
api_router.include_router(stats.router)


@api_router.get("/ping", tags=["system"], summary="API v1 连通性检查")
async def ping() -> dict:
    """用于验证 /api/v1 路由已正确挂载."""

    return success(
        data={
            "pong": True,
            "app": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "prefix": settings.API_V1_PREFIX,
        }
    )
