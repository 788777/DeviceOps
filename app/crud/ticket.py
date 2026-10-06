"""工单与工单评论 CRUD 数据访问层."""

from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.ticket import Ticket, TicketPriority, TicketStatus
from app.models.ticket_comment import TicketComment
from app.schemas.ticket import TicketCreate

# 工单状态机：只允许沿 pending -> processing -> resolved -> closed 单向推进一步，
# 不允许跳级（如 pending -> resolved），也不允许回退（如 resolved -> processing）。
ALLOWED_STATUS_TRANSITIONS: dict[TicketStatus, TicketStatus] = {
    TicketStatus.PENDING: TicketStatus.PROCESSING,
    TicketStatus.PROCESSING: TicketStatus.RESOLVED,
    TicketStatus.RESOLVED: TicketStatus.CLOSED,
}


def can_transition(current: TicketStatus, target: TicketStatus) -> bool:
    """判断状态流转是否合法."""

    return ALLOWED_STATUS_TRANSITIONS.get(current) == target


def next_status(current: TicketStatus) -> Optional[TicketStatus]:
    """当前状态的下一个合法状态（终态返回 None）."""

    return ALLOWED_STATUS_TRANSITIONS.get(current)


class CRUDTicket:
    """工单表数据访问对象."""

    # ===== 工单 =====

    def get(self, db: Session, ticket_id: int) -> Optional[Ticket]:
        """按主键查询工单."""

        return db.get(Ticket, ticket_id)

    def get_detail(self, db: Session, ticket_id: int) -> Optional[Ticket]:
        """按主键查询工单详情（预加载关联，避免 N+1）."""

        return db.execute(
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                selectinload(Ticket.device),
                selectinload(Ticket.creator),
                selectinload(Ticket.assignee),
                selectinload(Ticket.comments).selectinload(TicketComment.user),
            )
        ).scalar_one_or_none()

    def count(self, db: Session) -> int:
        """工单总数."""

        return db.execute(select(func.count()).select_from(Ticket)).scalar_one()

    def get_multi(
        self,
        db: Session,
        offset: int = 0,
        limit: int = 10,
        status: Optional[TicketStatus] = None,
        priority: Optional[TicketPriority] = None,
        assignee_id: Optional[int] = None,
        device_id: Optional[int] = None,
    ) -> tuple[Sequence[Ticket], int]:
        """分页 + 状态/优先级/负责人/设备过滤，返回 (数据列表, 总数)."""

        conditions = []
        if status is not None:
            conditions.append(Ticket.status == status)
        if priority is not None:
            conditions.append(Ticket.priority == priority)
        if assignee_id is not None:
            conditions.append(Ticket.assignee_id == assignee_id)
        if device_id is not None:
            conditions.append(Ticket.device_id == device_id)

        count_stmt = select(func.count()).select_from(Ticket)
        list_stmt = select(Ticket)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
            list_stmt = list_stmt.where(*conditions)

        total = db.execute(count_stmt).scalar_one()
        items = (
            db.execute(
                list_stmt.order_by(Ticket.id.desc()).offset(offset).limit(limit)
            )
            .scalars()
            .all()
        )
        return items, total

    def create(self, db: Session, obj_in: TicketCreate, creator_id: int) -> Ticket:
        """创建工单；新工单状态固定为 pending."""

        data = obj_in.model_dump()
        db_obj = Ticket(
            **data,
            creator_id=creator_id,
            status=TicketStatus.PENDING,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update_status(
        self, db: Session, db_obj: Ticket, new_status: TicketStatus
    ) -> Ticket:
        """更新工单状态."""

        db_obj.status = new_status
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def assign(self, db: Session, db_obj: Ticket, assignee_id: int) -> Ticket:
        """指派/转派工单."""

        db_obj.assignee_id = assignee_id
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    # ===== 评论 =====

    def get_comment(self, db: Session, comment_id: int) -> Optional[TicketComment]:
        """按主键查询评论."""

        return db.get(TicketComment, comment_id)

    def add_comment(
        self, db: Session, ticket_id: int, user_id: int, content: str
    ) -> TicketComment:
        """新增工单评论."""

        db_obj = TicketComment(ticket_id=ticket_id, user_id=user_id, content=content)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_comments(
        self, db: Session, ticket_id: int, offset: int = 0, limit: int = 20
    ) -> tuple[Sequence[TicketComment], int]:
        """分页查询工单评论，返回 (数据列表, 总数)."""

        condition = TicketComment.ticket_id == ticket_id
        total = db.execute(
            select(func.count()).select_from(TicketComment).where(condition)
        ).scalar_one()
        items = (
            db.execute(
                select(TicketComment)
                .where(condition)
                .options(selectinload(TicketComment.user))
                .order_by(TicketComment.id.asc())
                .offset(offset)
                .limit(limit)
            )
            .scalars()
            .all()
        )
        return items, total


ticket = CRUDTicket()

__all__ = [
    "ALLOWED_STATUS_TRANSITIONS",
    "CRUDTicket",
    "can_transition",
    "next_status",
    "ticket",
]
