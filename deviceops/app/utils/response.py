"""统一响应工具.

约定：所有业务接口都返回 ``{code, message, data}``。

- code：业务状态码，0 表示成功；失败时默认使用 HTTP 状态码（400/401/403/404/409/422/500）
- message：面向调用方的提示信息
- data：业务数据，失败时通常为 null（校验错误时为错误明细）
"""

from typing import Any, Optional, Sequence

from pydantic import BaseModel, Field

# 业务状态码约定
SUCCESS_CODE: int = 0
ERROR_CODE: int = 1


class ApiResponse(BaseModel):
    """统一响应结构（用于接口文档与类型标注）."""

    code: int = Field(default=SUCCESS_CODE, description="业务状态码，0 表示成功")
    message: str = Field(default="success", description="提示信息")
    data: Any = Field(default=None, description="业务数据")


def success(
    data: Any = None,
    message: str = "success",
    code: int = SUCCESS_CODE,
) -> dict[str, Any]:
    """构造成功响应体."""

    return {"code": code, "message": message, "data": data}


def error(
    message: str = "error",
    code: int = ERROR_CODE,
    data: Any = None,
) -> dict[str, Any]:
    """构造失败响应体."""

    return {"code": code, "message": message, "data": data}


def paginate(
    items: Sequence[Any],
    total: int,
    page: int = 1,
    page_size: int = 20,
    message: str = "success",
) -> dict[str, Any]:
    """构造分页成功响应体.

    data = {items, total, page, page_size, pages}
    """

    pages = (total + page_size - 1) // page_size if page_size else 0
    return success(
        data={
            "items": list(items),
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
        },
        message=message,
    )


class BusinessError(Exception):
    """业务异常.

    由 crud / service 层主动抛出，交给 main.py 的全局异常处理器转换成统一响应，
    避免业务代码里到处写 HTTPException。

    用法::

        raise BusinessError("设备编号已存在", status_code=409)
    """

    def __init__(
        self,
        message: str,
        code: Optional[int] = None,
        status_code: int = 400,
        data: Any = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.code = status_code if code is None else code
        self.data = data
        super().__init__(message)

    def to_dict(self) -> dict[str, Any]:
        """转换为统一响应体."""

        return error(message=self.message, code=self.code, data=self.data)


__all__ = [
    "ApiResponse",
    "BusinessError",
    "ERROR_CODE",
    "SUCCESS_CODE",
    "error",
    "paginate",
    "success",
]
