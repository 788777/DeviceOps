"""数据库引擎与会话管理."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# SQLite 在多线程（FastAPI 默认线程池）下需要关闭同线程检查
connect_args: dict = (
    {"check_same_thread": False} if settings.is_sqlite else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=settings.SQL_ECHO,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖：为每个请求提供独立数据库会话，请求结束后关闭."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
