"""告警 CRUD 数据访问层."""

from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertType
from app.schemas.alert import AlertCreate


class CRUDAlert:
    """告警表数据访问对象."""

    def get(self, db: Session, alert_id: int) -> Optional[Alert]:
        """按主键查询告警."""

        return db.get(Alert, alert_id)

    def count(self, db: Session) -> int:
        """告警总数."""

        return db.execute(select(func.count()).select_from(Alert)).scalar_one()

    def count_by_false_positive(self, db: Session, is_false_positive: bool) -> int:
        """按是否误报统计数量."""

        return db.execute(
            select(func.count())
            .select_from(Alert)
            .where(Alert.is_false_positive.is_(is_false_positive))
        ).scalar_one()

    def get_multi(
        self,
        db: Session,
        offset: int = 0,
        limit: int = 10,
        device_id: Optional[int] = None,
        type: Optional[AlertType] = None,
        is_false_positive: Optional[bool] = None,
    ) -> tuple[Sequence[Alert], int]:
        """分页 + 设备/类型/误报过滤，返回 (数据列表, 总数)."""

        conditions = []
        if device_id is not None:
            conditions.append(Alert.device_id == device_id)
        if type is not None:
            conditions.append(Alert.type == type)
        if is_false_positive is not None:
            conditions.append(Alert.is_false_positive.is_(is_false_positive))

        count_stmt = select(func.count()).select_from(Alert)
        list_stmt = select(Alert)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
            list_stmt = list_stmt.where(*conditions)

        total = db.execute(count_stmt).scalar_one()
        items = (
            db.execute(
                list_stmt.order_by(Alert.id.desc()).offset(offset).limit(limit)
            )
            .scalars()
            .all()
        )
        return items, total

    def create(self, db: Session, obj_in: AlertCreate) -> Alert:
        """新增告警."""

        db_obj = Alert(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def set_false_positive(
        self, db: Session, db_obj: Alert, is_false_positive: bool
    ) -> Alert:
        """标记/取消误报."""

        db_obj.is_false_positive = is_false_positive
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


alert = CRUDAlert()

__all__ = ["CRUDAlert", "alert"]
