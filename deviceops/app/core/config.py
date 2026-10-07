"""应用配置：基于 pydantic-settings，从 .env 与环境变量读取.

环境变量优先级（pydantic-settings 默认行为）：

    显式传参  >  环境变量  >  .env 文件  >  代码默认值

所以：
- 本地开发：复制 .env.example 为 .env，改里面的值；
- 容器部署：docker-compose 的 environment 直接注入，不需要 .env 文件；
- 临时切换：命令行前面加环境变量即可，例如
  ``$env:DATABASE_URL="sqlite:///./deviceops.db"; uvicorn app.main:app``
"""

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 项目根目录（deviceops/），用于定位 .env、日志目录等
BASE_DIR: Path = Path(__file__).resolve().parents[2]

# 允许用 ENV_FILE 指定别的配置文件（容器里可以指向挂载进来的文件）
ENV_FILE: str = os.getenv("ENV_FILE", str(BASE_DIR / ".env"))


class Settings(BaseSettings):
    """全局配置项，可通过 .env 或环境变量覆盖."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ===== Application =====
    PROJECT_NAME: str = "DeviceOps"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "设备运维工单管理系统"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # ===== Database =====
    # 开发默认 SQLite；切 MySQL 只需改这一个值：
    # mysql+pymysql://user:password@host:3306/deviceops?charset=utf8mb4
    DATABASE_URL: str = "sqlite:///./deviceops.db"

    # 是否打印 SQL（排查问题时把 SQL_ECHO 设为 true）
    SQL_ECHO: bool = False

    # ===== Cache / Queue =====
    # docker-compose 里注入 redis://redis:6379/0；本地不跑 Redis 时留空即可
    REDIS_URL: str = ""

    # ===== Security =====
    SECRET_KEY: str = "dev-secret-key-please-change-in-production"
    ALGORITHM: str = "HS256"
    # 令牌有效期（分钟）；按需求默认 60 分钟
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ===== Logging =====
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "logs"
    LOG_FILE_NAME: str = "app.log"

    # ===== CORS =====
    # 用逗号分隔的字符串而不是 list，避免环境变量里的 "a,b" 触发 JSON 解析错误：
    #   CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
    # 取值 "*" 表示允许全部。用 settings.cors_origins 拿到 list。
    CORS_ORIGINS: str = "*"

    # ==================== 便捷属性 ====================

    @property
    def database_backend(self) -> str:
        """数据库后端类型：sqlite / mysql / other."""

        url = self.DATABASE_URL.lower()
        if url.startswith("sqlite"):
            return "sqlite"
        if url.startswith("mysql"):
            return "mysql"
        return "other"

    @property
    def is_sqlite(self) -> bool:
        """当前是否使用 SQLite 数据库."""

        return self.database_backend == "sqlite"

    @property
    def is_mysql(self) -> bool:
        """当前是否使用 MySQL 数据库."""

        return self.database_backend == "mysql"

    @property
    def log_dir_path(self) -> Path:
        """日志目录绝对路径."""

        path = Path(self.LOG_DIR)
        return path if path.is_absolute() else BASE_DIR / path

    @property
    def cors_origins(self) -> list[str]:
        """把 CORS_ORIGINS 解析成列表."""

        raw = (self.CORS_ORIGINS or "").strip()
        if not raw:
            return []
        return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    """获取配置单例（带缓存）."""

    return Settings()


settings: Settings = get_settings()
