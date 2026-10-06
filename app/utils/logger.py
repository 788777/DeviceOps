"""日志配置：同时输出到控制台与 logs/app.log（按大小轮转）."""

import logging
import logging.config
import sys
from pathlib import Path
from typing import Optional, Union

from app.core.config import settings

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# 默认日志文件名（位于 settings.LOG_DIR 目录下）
LOG_FILE_NAME = "app.log"

# 轮转策略：单文件 10MB，保留 5 份
MAX_BYTES = 10 * 1024 * 1024
BACKUP_COUNT = 5


def setup_logging(
    level: Optional[str] = None,
    log_file: Optional[Union[str, Path]] = None,
) -> Path:
    """初始化日志（重复调用安全），返回日志文件绝对路径.

    :param level: 日志级别，默认读取 settings.LOG_LEVEL
    :param log_file: 日志文件名或路径，默认 logs/app.log
    """

    log_level = (level or settings.LOG_LEVEL or "INFO").upper()
    log_dir = settings.log_dir_path
    log_dir.mkdir(parents=True, exist_ok=True)

    file_path = (
        Path(log_file)
        if log_file
        else log_dir / (settings.LOG_FILE_NAME or LOG_FILE_NAME)
    )
    if not file_path.is_absolute():
        file_path = log_dir / file_path
    file_path.parent.mkdir(parents=True, exist_ok=True)

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": LOG_FORMAT,
                    "datefmt": DATE_FORMAT,
                },
            },
            "handlers": {
                # 控制台
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "stream": sys.stdout,
                },
                # 文件：logs/app.log
                "file": {
                    "class": "logging.handlers.RotatingFileHandler",
                    "formatter": "default",
                    "filename": str(file_path),
                    "maxBytes": MAX_BYTES,
                    "backupCount": BACKUP_COUNT,
                    "encoding": "utf-8",
                },
            },
            "root": {
                "level": log_level,
                "handlers": ["console", "file"],
            },
            "loggers": {
                # uvicorn 自身的日志也统一走控制台，避免重复输出到文件
                "uvicorn": {"level": log_level, "handlers": ["console"], "propagate": False},
                "uvicorn.error": {"level": log_level, "handlers": ["console"], "propagate": False},
                "uvicorn.access": {"level": log_level, "handlers": ["console"], "propagate": False},
                # SQLAlchemy 只在需要排查 SQL 时手动调成 INFO
                "sqlalchemy.engine": {"level": "WARNING", "handlers": ["console"], "propagate": False},
            },
        }
    )
    return file_path


def get_logger(name: str = "deviceops") -> logging.Logger:
    """获取指定名称的 logger."""

    return logging.getLogger(name)


# 模块级默认 logger，便于 `from app.utils.logger import logger` 直接使用
logger = get_logger()

__all__ = ["LOG_FILE_NAME", "get_logger", "logger", "setup_logging"]
