"""用户 CRUD 数据访问层."""

from typing import Optional, Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate


class CRUDUser:
    """用户表数据访问对象."""

    def get(self, db: Session, user_id: int) -> Optional[User]:
        """按主键查询用户."""

        return db.get(User, user_id)

    def get_by_username(self, db: Session, username: str) -> Optional[User]:
        """按用户名查询用户."""

        return db.execute(
            select(User).where(User.username == username)
        ).scalar_one_or_none()

    def count(self, db: Session) -> int:
        """用户总数."""

        return db.execute(select(func.count()).select_from(User)).scalar_one()

    def get_multi(
        self,
        db: Session,
        offset: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        role: Optional[UserRole] = None,
    ) -> tuple[Sequence[User], int]:
        """分页查询用户，返回 (数据列表, 总数)."""

        conditions = []
        if keyword:
            conditions.append(User.username.ilike(f"%{keyword}%"))
        if role is not None:
            conditions.append(User.role == role)

        count_stmt = select(func.count()).select_from(User)
        list_stmt = select(User)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
            list_stmt = list_stmt.where(*conditions)

        total = db.execute(count_stmt).scalar_one()
        items = (
            db.execute(
                list_stmt.order_by(User.id.desc()).offset(offset).limit(limit)
            )
            .scalars()
            .all()
        )
        return items, total

    def create(self, db: Session, obj_in: UserCreate) -> User:
        """创建用户（密码自动 bcrypt 加密）."""

        db_obj = User(
            username=obj_in.username,
            hashed_password=hash_password(obj_in.password),
            role=obj_in.role,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: User, obj_in: UserUpdate) -> User:
        """更新用户（仅更新传入的字段）."""

        data = obj_in.model_dump(exclude_unset=True)
        password = data.pop("password", None)
        for field, value in data.items():
            setattr(db_obj, field, value)
        if password:
            db_obj.hashed_password = hash_password(password)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update_role(self, db: Session, db_obj: User, role: UserRole) -> User:
        """修改用户角色."""

        db_obj.role = role
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def authenticate(
        self, db: Session, username: str, password: str
    ) -> Optional[User]:
        """校验用户名 + 密码，成功返回用户，失败返回 None."""

        user = self.get_by_username(db, username)
        if user is None:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user


user = CRUDUser()

__all__ = ["CRUDUser", "user"]
