"""工单与工单评论接口."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_engineer
from app.crud.device import device as crud_device
from app.crud.ticket import can_transition, next_status, ticket as crud_ticket
from app.crud.user import user as crud_user
from app.models.ticket import Ticket, TicketPriority, TicketStatus
from app.models.user import User, UserRole
from app.schemas.ticket import (
    TicketAssignRequest,
    TicketCommentCreate,
    TicketCommentOut,
    TicketCreate,
    TicketDetail,
    TicketOut,
    TicketStatusUpdate,
)
from app.utils.response import paginate, success

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _get_ticket_or_404(db: Session, ticket_id: int) -> Ticket:
    """按 ID 取工单，不存在则抛 404."""

    ticket_obj = crud_ticket.get(db, ticket_id)
    if ticket_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="工单不存在"
        )
    return ticket_obj


def _ensure_can_operate(ticket_obj: Ticket, current_user: User) -> None:
    """工单操作权限：仅负责人本人或管理员."""

    if current_user.role == UserRole.ADMIN:
        return
    if ticket_obj.assignee_id is not None and ticket_obj.assignee_id == current_user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="只有工单负责人或管理员可以执行该操作",
    )


@router.get("", summary="工单列表（分页/多条件过滤）", response_model=None)
async def list_tickets(
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    size: int = Query(default=10, ge=1, le=100, description="每页数量"),
    status_filter: Optional[TicketStatus] = Query(
        default=None, alias="status", description="按状态过滤"
    ),
    priority: Optional[TicketPriority] = Query(
        default=None, description="按优先级过滤"
    ),
    assignee_id: Optional[int] = Query(default=None, description="按负责人过滤"),
    device_id: Optional[int] = Query(default=None, description="按关联设备过滤"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """分页查询工单，登录用户均可访问."""

    items, total = crud_ticket.get_multi(
        db,
        offset=(page - 1) * size,
        limit=size,
        status=status_filter,
        priority=priority,
        assignee_id=assignee_id,
        device_id=device_id,
    )
    return paginate(
        items=[TicketOut.model_validate(item).model_dump(mode="json") for item in items],
        total=total,
        page=page,
        page_size=size,
    )


@router.post("", summary="创建工单", response_model=None)
async def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """创建工单：状态固定为 pending，创建人为当前登录用户."""

    if crud_device.get(db, payload.device_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="关联设备不存在"
        )
    if payload.assignee_id is not None and crud_user.get(db, payload.assignee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="负责人不存在"
        )

    ticket_obj = crud_ticket.create(db, payload, creator_id=current_user.id)
    logger.info(
        "ticket created: id=%s creator=%s device_id=%s priority=%s",
        ticket_obj.id,
        current_user.username,
        ticket_obj.device_id,
        ticket_obj.priority.value,
    )
    return success(
        data=TicketOut.model_validate(ticket_obj).model_dump(mode="json"),
        message="工单创建成功",
    )


@router.get("/{ticket_id}", summary="工单详情（含评论）", response_model=None)
async def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """查询工单详情，包含设备、创建人、负责人与评论列表."""

    ticket_obj = crud_ticket.get_detail(db, ticket_id)
    if ticket_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="工单不存在"
        )
    return success(
        data=TicketDetail.model_validate(ticket_obj).model_dump(mode="json")
    )


@router.patch("/{ticket_id}/assign", summary="指派/转派工单（engineer/admin）", response_model=None)
async def assign_ticket(
    ticket_id: int,
    payload: TicketAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_engineer),
) -> dict:
    """指派负责人，工程师或管理员可操作."""

    ticket_obj = _get_ticket_or_404(db, ticket_id)
    if crud_user.get(db, payload.assignee_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="负责人不存在"
        )

    ticket_obj = crud_ticket.assign(db, ticket_obj, payload.assignee_id)
    logger.info(
        "ticket assigned: id=%s assignee_id=%s operator=%s",
        ticket_obj.id,
        ticket_obj.assignee_id,
        current_user.username,
    )
    return success(
        data=TicketOut.model_validate(ticket_obj).model_dump(mode="json"),
        message="指派成功",
    )


@router.patch("/{ticket_id}/status", summary="流转工单状态（assignee/admin）", response_model=None)
async def update_ticket_status(
    ticket_id: int,
    payload: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """按状态机流转：pending -> processing -> resolved -> closed，禁止跳级与回退."""

    ticket_obj = _get_ticket_or_404(db, ticket_id)
    _ensure_can_operate(ticket_obj, current_user)

    current_status = ticket_obj.status
    target_status = payload.status

    if target_status == current_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"工单当前已是 {current_status.value} 状态",
        )
    if not can_transition(current_status, target_status):
        allowed = next_status(current_status)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"非法状态流转：{current_status.value} -> {target_status.value}；"
                + (f"只允许流转到 {allowed.value}" if allowed else "该工单已处于终态 closed")
            ),
        )

    ticket_obj = crud_ticket.update_status(db, ticket_obj, target_status)
    logger.info(
        "ticket status changed: id=%s %s -> %s operator=%s",
        ticket_obj.id,
        current_status.value,
        target_status.value,
        current_user.username,
    )
    return success(
        data=TicketOut.model_validate(ticket_obj).model_dump(mode="json"),
        message="状态更新成功",
    )


@router.post("/{ticket_id}/comments", summary="新增工单评论", response_model=None)
async def create_comment(
    ticket_id: int,
    payload: TicketCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """新增评论：创建人、负责人或管理员可评论."""

    ticket_obj = _get_ticket_or_404(db, ticket_id)
    is_creator = ticket_obj.creator_id == current_user.id
    is_assignee = ticket_obj.assignee_id == current_user.id
    is_admin = current_user.role == UserRole.ADMIN
    if not (is_creator or is_assignee or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有工单创建人、负责人或管理员可以评论",
        )

    comment_obj = crud_ticket.add_comment(
        db, ticket_id=ticket_id, user_id=current_user.id, content=payload.content
    )
    logger.info(
        "ticket comment added: ticket_id=%s comment_id=%s user=%s",
        ticket_id,
        comment_obj.id,
        current_user.username,
    )
    return success(
        data=TicketCommentOut.model_validate(comment_obj).model_dump(mode="json"),
        message="评论成功",
    )


@router.get("/{ticket_id}/comments", summary="工单评论列表", response_model=None)
async def list_comments(
    ticket_id: int,
    page: int = Query(default=1, ge=1, description="页码，从 1 开始"),
    size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    """分页查询工单评论（按时间正序），登录用户均可访问."""

    _get_ticket_or_404(db, ticket_id)
    items, total = crud_ticket.get_comments(
        db, ticket_id=ticket_id, offset=(page - 1) * size, limit=size
    )
    return paginate(
        items=[
            TicketCommentOut.model_validate(item).model_dump(mode="json")
            for item in items
        ],
        total=total,
        page=page,
        page_size=size,
    )
