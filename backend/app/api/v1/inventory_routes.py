import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.inventory import InventoryItem, InventoryMovement
from app.models.product import Product
from app.schemas.inventory_schema import (
    InventoryItemCreate,
    InventoryItemDetailResponse,
    InventoryMovementResponse,
    InventoryStatusUpdate,
)


router = APIRouter(
    prefix="/api/inventory",
    tags=["Inventory"],
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_inventory_item_with_product(
    db: Session,
    item_id: uuid.UUID,
) -> InventoryItem | None:
    statement = (
        select(InventoryItem)
        .options(joinedload(InventoryItem.product))
        .where(InventoryItem.id == item_id)
    )

    return db.scalar(statement)


def serialize_inventory_item(
    item: InventoryItem,
) -> InventoryItemDetailResponse:
    return InventoryItemDetailResponse(
        id=item.id,
        product_id=item.product_id,
        sku=item.sku,
        status=item.status,
        location=item.location,
        store_type=item.store_type,
        condition=item.condition,
        batch_number=item.batch_number,
        unit_cost=item.unit_cost,
        expected_selling_price=item.expected_selling_price,
        production_start_date=item.production_start_date,
        estimated_arrival_date=item.estimated_arrival_date,
        actual_arrival_date=item.actual_arrival_date,
        received_date=item.received_date,
        reserved_order_id=item.reserved_order_id,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
        product_name=item.product.name,
        category=item.product.category,
        material=item.product.material,
        color=item.product.color,
    )


@router.get(
    "/items",
    response_model=list[InventoryItemDetailResponse],
)
def list_inventory_items(
    search: str | None = Query(default=None, max_length=100),
    status_filter: str | None = Query(
        default=None,
        alias="status",
        max_length=50,
    ),
    store_type: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[InventoryItemDetailResponse]:
    statement = (
        select(InventoryItem)
        .options(joinedload(InventoryItem.product))
    )

    if search:
        search_pattern = f"%{search.strip()}%"

        statement = statement.where(
            or_(
                InventoryItem.sku.ilike(search_pattern),
                InventoryItem.location.ilike(search_pattern),
                InventoryItem.batch_number.ilike(search_pattern),
            )
        )

    if status_filter:
        statement = statement.where(
            func.lower(InventoryItem.status)
            == status_filter.strip().lower()
        )

    if store_type:
        statement = statement.where(
            func.lower(InventoryItem.store_type)
            == store_type.strip().lower()
        )

    statement = (
        statement
        .order_by(InventoryItem.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    inventory_items = db.scalars(statement).unique().all()

    return [
        serialize_inventory_item(item)
        for item in inventory_items
    ]


@router.post(
    "/items",
    response_model=InventoryItemDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inventory_item(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
) -> InventoryItemDetailResponse:
    product = db.get(Product, payload.product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    now = utc_now()

    inventory_item = InventoryItem(
        product_id=product.id,
        sku=product.sku,
        status=payload.status,
        location=payload.location.strip(),
        store_type=payload.store_type,
        condition=payload.condition,
        batch_number=(
            payload.batch_number.strip()
            if payload.batch_number
            else None
        ),
        unit_cost=(
            payload.unit_cost
            if payload.unit_cost is not None
            else product.default_cost
        ),
        expected_selling_price=(
            payload.expected_selling_price
            if payload.expected_selling_price is not None
            else product.default_price
        ),
        production_start_date=payload.production_start_date,
        estimated_arrival_date=payload.estimated_arrival_date,
        actual_arrival_date=payload.actual_arrival_date,
        received_date=payload.received_date,
        reserved_order_id=None,
        notes=payload.notes.strip() if payload.notes else None,
        created_at=now,
        updated_at=now,
    )

    try:
        db.add(inventory_item)
        db.flush()

        movement = InventoryMovement(
            inventory_item_id=inventory_item.id,
            from_status=None,
            to_status=inventory_item.status,
            from_location=None,
            to_location=inventory_item.location,
            movement_reason="Inventory item created.",
            performed_by=None,
            created_at=now,
        )

        db.add(movement)
        db.commit()

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Unable to create the inventory item.",
        ) from error

    created_item = get_inventory_item_with_product(
        db,
        inventory_item.id,
    )

    if created_item is None:
        raise HTTPException(
            status_code=500,
            detail="Created inventory item could not be loaded.",
        )

    return serialize_inventory_item(created_item)


@router.get(
    "/items/{item_id}",
    response_model=InventoryItemDetailResponse,
)
def get_inventory_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> InventoryItemDetailResponse:
    item = get_inventory_item_with_product(db, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Inventory item not found.",
        )

    return serialize_inventory_item(item)


@router.patch(
    "/items/{item_id}/status",
    response_model=InventoryItemDetailResponse,
)
def update_inventory_status(
    item_id: uuid.UUID,
    payload: InventoryStatusUpdate,
    db: Session = Depends(get_db),
) -> InventoryItemDetailResponse:
    inventory_item = db.get(InventoryItem, item_id)

    if inventory_item is None:
        raise HTTPException(
            status_code=404,
            detail="Inventory item not found.",
        )

    previous_status = inventory_item.status
    previous_location = inventory_item.location

    new_location = (
        payload.location.strip()
        if payload.location
        else inventory_item.location
    )

    inventory_item.status = payload.status
    inventory_item.location = new_location

    if payload.store_type is not None:
        inventory_item.store_type = payload.store_type

    inventory_item.updated_at = utc_now()

    movement = InventoryMovement(
        inventory_item_id=inventory_item.id,
        from_status=previous_status,
        to_status=payload.status,
        from_location=previous_location,
        to_location=new_location,
        movement_reason=(
            payload.movement_reason.strip()
            if payload.movement_reason
            else f"Status changed from {previous_status} "
            f"to {payload.status}."
        ),
        performed_by=None,
        created_at=utc_now(),
    )

    try:
        db.add(movement)
        db.commit()

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Unable to update the inventory status.",
        ) from error

    updated_item = get_inventory_item_with_product(
        db,
        inventory_item.id,
    )

    if updated_item is None:
        raise HTTPException(
            status_code=500,
            detail="Updated inventory item could not be loaded.",
        )

    return serialize_inventory_item(updated_item)


@router.get(
    "/items/{item_id}/movements",
    response_model=list[InventoryMovementResponse],
)
def list_inventory_movements(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[InventoryMovement]:
    item_exists = db.scalar(
        select(InventoryItem.id).where(
            InventoryItem.id == item_id
        )
    )

    if item_exists is None:
        raise HTTPException(
            status_code=404,
            detail="Inventory item not found.",
        )

    statement = (
        select(InventoryMovement)
        .where(InventoryMovement.inventory_item_id == item_id)
        .order_by(InventoryMovement.created_at.desc())
    )

    return list(db.scalars(statement).all())