"""设备 CRUD 数据访问层."""

from typing import Optional, Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.device import Device, DeviceStatus
from app.schemas.device import DeviceCreate, DeviceUpdate


class CRUDDevice:
    """设备表数据访问对象."""

    def get(self, db: Session, device_id: int) -> Optional[Device]:
        """按主键查询设备."""

        return db.get(Device, device_id)

    def get_by_device_no(self, db: Session, device_no: str) -> Optional[Device]:
        """按设备编号查询设备（编号唯一）."""

        return db.execute(
            select(Device).where(Device.device_no == device_no)
        ).scalar_one_or_none()

    def count(self, db: Session) -> int:
        """设备总数."""

        return db.execute(select(func.count()).select_from(Device)).scalar_one()

    def get_multi(
        self,
        db: Session,
        offset: int = 0,
        limit: int = 10,
        keyword: Optional[str] = None,
        status: Optional[DeviceStatus] = None,
    ) -> tuple[Sequence[Device], int]:
        """分页 + 搜索 + 状态过滤，返回 (数据列表, 总数).

        :param keyword: 对 device_no / model 做模糊匹配
        :param status: 按设备状态精确过滤
        """

        conditions = []
        if keyword:
            pattern = f"%{keyword}%"
            conditions.append(
                or_(Device.device_no.ilike(pattern), Device.model.ilike(pattern))
            )
        if status is not None:
            conditions.append(Device.status == status)

        count_stmt = select(func.count()).select_from(Device)
        list_stmt = select(Device)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
            list_stmt = list_stmt.where(*conditions)

        total = db.execute(count_stmt).scalar_one()
        items = (
            db.execute(
                list_stmt.order_by(Device.id.desc()).offset(offset).limit(limit)
            )
            .scalars()
            .all()
        )
        return items, total

    def create(self, db: Session, obj_in: DeviceCreate) -> Device:
        """创建设备."""

        db_obj = Device(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Device, obj_in: DeviceUpdate) -> Device:
        """更新设备（仅更新传入的字段）."""

        data = obj_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, db_obj: Device) -> None:
        """删除设备（关联工单、告警按 ORM cascade 一并删除）."""

        db.delete(db_obj)
        db.commit()


device = CRUDDevice()

__all__ = ["CRUDDevice", "device"]
