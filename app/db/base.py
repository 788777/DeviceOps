"""SQLAlchemy 声明式基类."""

from sqlalchemy.orm import declarative_base

# 所有 ORM 模型继承该 Base；Alembic 也以它的 metadata 作为自动生成依据
Base = declarative_base()
