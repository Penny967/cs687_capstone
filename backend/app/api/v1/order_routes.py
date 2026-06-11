import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.order import CustomerOrder
from app.schemas.order_schema import (
    CustomerOrderDetailResponse,
    CustomerOrderResponse,
    CustomerOrderStatusUpdate,
)
from app.services.order_service import (
    load_order_with_items,
    update_order_status,
)


router = APIRouter(
    prefix="/api/orders",
    tags=["Orders"],
)


@router.get(
    "",
    response_model=list[CustomerOrderResponse],
)
def list_orders(
    search: str | None = Query(default=None, max_length=100),
    status: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[CustomerOrder]:
    statement = select(CustomerOrder)

    if search:
        search_pattern = f"%{search.strip()}%"

        statement = statement.where(
            or_(
                CustomerOrder.order_number.ilike(search_pattern),
                CustomerOrder.customer_name.ilike(search_pattern),
                CustomerOrder.customer_phone.ilike(search_pattern),
            )
        )

    if status:
        statement = statement.where(
            func.lower(CustomerOrder.status)
            == status.strip().lower()
        )

    statement = (
        statement
        .order_by(CustomerOrder.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


@router.get(
    "/{order_id}",
    response_model=CustomerOrderDetailResponse,
)
def get_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> CustomerOrder:
    statement = (
        select(CustomerOrder)
        .options(selectinload(CustomerOrder.items))
        .where(CustomerOrder.id == order_id)
    )

    order = db.scalar(statement)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found.",
        )

    return order

@router.patch(
    "/{order_id}/status",
    response_model=CustomerOrderDetailResponse,
)
def patch_order_status(
    order_id: uuid.UUID,
    payload: CustomerOrderStatusUpdate,
    db: Session = Depends(get_db),
) -> CustomerOrder:
    try:
        update_order_status(
            db,
            order_id=order_id,
            payload=payload,
        )

        db.commit()

        updated_order = load_order_with_items(
            db,
            order_id,
        )

        if updated_order is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Updated order could not be loaded."
                ),
            )

        return updated_order

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "The order status update conflicted with "
                "existing database data."
            ),
        ) from error

    except SQLAlchemyError as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to update the order status.",
        ) from error