"""Alembic 迁移环境（对接 DeviceOps 应用配置）.

两个关键点：
1. 数据库地址来自 ``app.core.config.settings.DATABASE_URL``，
   所以 .env / 环境变量怎么配，迁移就跟着怎么走，开发 SQLite、生产 MySQL 都不用改本文件。
2. 目标元数据来自 ``app.db.base.Base.metadata``；
   必须 import app.models，否则元数据里没有表，autogenerate 会生成空迁移。
"""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool

# 保证在任意目录执行 alembic 都能 import app
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app import models  # noqa: E402,F401  注册全部 ORM 模型到 Base.metadata

# Alembic Config 对象
config = context.config

# 读取 alembic.ini 里的日志配置（控制台输出）
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# autogenerate 的比对目标
target_metadata = Base.metadata


def get_url() -> str:
    """迁移使用的数据库地址.

    优先级：环境变量 DATABASE_URL > .env > app 默认值。
    临时切库（比如给一个空库生成初始迁移）时直接设置环境变量即可：

        $env:DATABASE_URL="sqlite:///./tmp_migrate.db"; alembic revision --autogenerate -m "init"
    """

    return os.getenv("DATABASE_URL") or settings.DATABASE_URL


def _configure(connection=None) -> None:
    """offline / online 两种模式共用的 context 配置."""

    options = {
        "target_metadata": target_metadata,
        # 字段类型变化也纳入 diff
        "compare_type": True,
        # SQLite 的 ALTER 能力有限，batch 模式会自动用"重建表"的方式改结构
        "render_as_batch": True,
        # 版本号表名，保持默认
        "version_table": "alembic_version",
    }
    if connection is None:
        context.configure(
            url=get_url(),
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
            **options,
        )
    else:
        context.configure(connection=connection, **options)


def run_migrations_offline() -> None:
    """离线模式：只生成 SQL，不连接数据库（alembic upgrade head --sql）."""

    _configure()
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：连接数据库执行迁移."""

    # 直接 create_engine 而非 engine_from_config：
    # 避免密码里带 % 时 configparser 的插值报错（MySQL 密码常见 @ / % 等字符）
    connectable = create_engine(get_url(), poolclass=pool.NullPool, future=True)

    with connectable.connect() as connection:
        _configure(connection)
        with context.begin_transaction():
            context.run_migrations()

    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
