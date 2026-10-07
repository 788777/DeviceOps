"""DeviceOps 应用入口：路由注册、全局异常处理、请求日志."""

import logging
import time
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import settings
from app.utils.logger import LOG_FILE_NAME, setup_logging
from app.utils.response import BusinessError, error, success

# 初始化日志（控制台 + logs/app.log）
LOG_PATH = setup_logging()
logger = logging.getLogger(__name__)
access_logger = logging.getLogger("deviceops.access")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期：启动 / 关闭日志."""

    logger.info(
        "%s v%s starting | debug=%s | database=%s | log_file=%s",
        settings.PROJECT_NAME,
        settings.VERSION,
        settings.DEBUG,
        settings.DATABASE_URL,
        LOG_PATH,
    )
    yield
    logger.info("%s shutting down", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    # 必须为 False：debug=True 时 Starlette 的 ServerErrorMiddleware 会绕过
    # 下面的 Exception 处理器，直接返回明文堆栈，既破坏统一响应格式也会泄漏内部信息。
    # 调试信息统一走日志（logs/app.log），不再返回给客户端。
    debug=False,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ===== CORS：来源取自 CORS_ORIGINS 环境变量（逗号分隔，* 表示全部）=====
# 放在这里是为了让它成为最外层中间件，连 401/500 的响应也带上 CORS 头，
# 否则前端在浏览器里只会看到 "CORS error" 而看不到真正的错误信息。
_cors_origins = settings.cors_origins
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        # 通配符 + 携带凭证是浏览器明确禁止的组合，这里按来源自动降级
        allow_credentials=_cors_origins != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    logger.info("CORS enabled: origins=%s", _cors_origins)

# ===== 全局异常处理：任何错误也返回 {code, message, data} =====

# 默认状态码文案（Starlette 默认返回英文，这里统一成中文）
STATUS_MESSAGES: dict[int, str] = {
    400: "请求参数错误",
    401: "登录状态无效或已过期，请重新登录",
    403: "权限不足",
    404: "请求的资源不存在",
    405: "请求方法不被允许",
    409: "资源冲突",
    422: "请求参数校验失败",
    429: "请求过于频繁，请稍后重试",
    500: "服务器内部错误",
    502: "上游服务异常",
    503: "服务暂不可用",
}


def _is_default_phrase(status_code: int, detail: str) -> bool:
    """判断 detail 是否为框架的默认英文文案（如 "Not Found"）."""

    try:
        return detail == HTTPStatus(status_code).phrase
    except ValueError:
        return False


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """HTTPException（401/403/404/405/409...）统一为响应格式."""

    detail = exc.detail
    if isinstance(detail, dict):
        code = detail.get("code", exc.status_code)
        message = detail.get("message", str(detail))
        data = detail.get("data")
    else:
        code = exc.status_code
        message = str(detail)
        data = None
        if _is_default_phrase(exc.status_code, message):
            message = STATUS_MESSAGES.get(exc.status_code, message)
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(error(message=message, code=code, data=data)),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(BusinessError)
async def business_exception_handler(request: Request, exc: BusinessError) -> JSONResponse:
    """业务异常统一为响应格式，并记录告警日志."""

    logger.warning(
        "business error: %s %s -> [%s] %s",
        request.method,
        request.url.path,
        exc.code,
        exc.message,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(exc.to_dict()),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """请求参数校验失败统一返回 422."""

    logger.warning(
        "validation error: %s %s -> %s",
        request.method,
        request.url.path,
        exc.errors(),
    )
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(
            error(message="请求参数校验失败", code=422, data=exc.errors())
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """兜底异常，避免把堆栈直接暴露给客户端；同时写入日志便于排查."""

    request_id = getattr(request.state, "request_id", None)
    logger.exception(
        "unhandled error: %s %s (request_id=%s)",
        request.method,
        request.url.path,
        request_id,
    )
    return JSONResponse(
        status_code=500,
        content=jsonable_encoder(
            error(message="服务器内部错误", code=500, data={"request_id": request_id})
        ),
        headers={"X-Request-ID": request_id} if request_id else None,
    )


# ===== 请求日志中间件 =====


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """为每个请求生成 request_id，并记录访问日志（含耗时）."""

    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
    request.state.request_id = request_id
    client = request.client.host if request.client else "-"
    start = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        cost_ms = (time.perf_counter() - start) * 1000
        access_logger.exception(
            "request_id=%s %s %s client=%s -> EXCEPTION %.2fms",
            request_id,
            request.method,
            request.url.path,
            client,
            cost_ms,
        )
        raise

    cost_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    access_logger.info(
        "request_id=%s %s %s client=%s -> %s %.2fms",
        request_id,
        request.method,
        request.url.path,
        client,
        response.status_code,
        cost_ms,
    )
    return response


# 注册 v1 路由
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["system"], summary="健康检查")
async def health() -> dict:
    """健康检查接口（统一响应格式）."""

    return success(
        data={
            "status": "ok",
            "app": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "database": "sqlite" if settings.is_sqlite else "mysql",
        }
    )


@app.get("/", tags=["system"], summary="服务信息")
async def root() -> dict:
    """根路径，返回文档入口."""

    return success(
        data={
            "app": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "api": settings.API_V1_PREFIX,
        }
    )
