from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.analytics import SalesAnalyticsRecord
from app.models.inventory import InventoryItem, InventoryMovement
from app.models.order import CustomerOrder, CustomerOrderItem
from app.schemas.order_schema import CustomerOrderStatusUpdate


AVAILABLE_INVENTORY_STATUSES = {
    "local_warehouse",
    "showroom",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def calculate_season(record_date: date) -> str:
    month = record_date.month

    if month in {3, 4, 5}:
        return "Spring"

    if month in {6, 7, 8}:
        return "Summer"

    if month in {9, 10, 11}:
        return "Fall"

    return "Winter"


def calculate_delivery_days(
    inventory_item: InventoryItem | None,
) -> int | None:
    if inventory_item is None:
        return None

    if (
        inventory_item.production_start_date is None
        or inventory_item.actual_arrival_date is None
    ):
        return None

    difference = (
        inventory_item.actual_arrival_date
        - inventory_item.production_start_date
    ).days

    if difference < 0:
        return None

    return difference


def count_available_inventory(
    db: Session,
    sku: str,
) -> int:
    statement = (
        select(func.count(InventoryItem.id))
        .where(InventoryItem.sku == sku)
        .where(
            InventoryItem.status.in_(
                AVAILABLE_INVENTORY_STATUSES
            )
        )
    )

    return int(db.scalar(statement) or 0)


def load_order_with_items(
    db: Session,
    order_id: uuid.UUID,
) -> CustomerOrder | None:
    statement = (
        select(CustomerOrder)
        .options(
            selectinload(CustomerOrder.items).joinedload(
                CustomerOrderItem.product
            ),
            selectinload(CustomerOrder.items).joinedload(
                CustomerOrderItem.inventory_item
            ),
        )
        .where(CustomerOrder.id == order_id)
    )

    return db.scalar(statement)


def append_order_note(
    order: CustomerOrder,
    note: str | None,
) -> None:
    if note is None or not note.strip():
        return

    cleaned_note = note.strip()

    if order.notes:
        order.notes = f"{order.notes}\n{cleaned_note}"
    else:
        order.notes = cleaned_note


def mark_inventory_item_as_sold(
    db: Session,
    *,
    inventory_item: InventoryItem,
    order: CustomerOrder,
    changed_at: datetime,
) -> None:
    if inventory_item.status == "sold":
        return

    previous_status = inventory_item.status
    previous_location = inventory_item.location

    inventory_item.status = "sold"
    inventory_item.location = "Customer Delivery"
    inventory_item.store_type = "other"
    inventory_item.reserved_order_id = order.id
    inventory_item.updated_at = changed_at

    movement = InventoryMovement(
        inventory_item_id=inventory_item.id,
        from_status=previous_status,
        to_status="sold",
        from_location=previous_location,
        to_location="Customer Delivery",
        movement_reason=(
            f"Sold through delivered order "
            f"{order.order_number}."
        ),
        performed_by=None,
        created_at=changed_at,
    )

    db.add(movement)


def create_analytics_record(
    db: Session,
    *,
    order: CustomerOrder,
    order_item: CustomerOrderItem,
    delivered_date: date,
) -> None:
    existing_record_id = db.scalar(
        select(SalesAnalyticsRecord.id).where(
            SalesAnalyticsRecord.order_item_id
            == order_item.id
        )
    )

    if existing_record_id is not None:
        return

    product = order_item.product
    inventory_item = order_item.inventory_item

    if product is None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Order item {order_item.id} does not have "
                "a valid product."
            ),
        )

    inventory_count = count_available_inventory(
        db,
        order_item.sku,
    )

    cost = (
        inventory_item.unit_cost
        if inventory_item is not None
        and inventory_item.unit_cost is not None
        else product.default_cost
    )

    location = (
        inventory_item.location
        if inventory_item is not None
        else "Unknown"
    )

    store_type = (
        inventory_item.store_type
        if inventory_item is not None
        else "unknown"
    )

    analytics_record = SalesAnalyticsRecord(
        order_id=order.id,
        order_number=order.order_number,
        order_item_id=order_item.id,
        inventory_item_id=order_item.inventory_item_id,
        product_id=order_item.product_id,
        sku=order_item.sku,
        product_name=order_item.product_name,
        price=order_item.final_price,
        cost=cost or Decimal("0.00"),
        sales=order_item.quantity,
        inventory=inventory_count,
        delivery_days=calculate_delivery_days(
            inventory_item
        ),
        category=product.category,
        material=product.material,
        color=product.color,
        location=location,
        season=calculate_season(delivered_date),
        store_type=store_type,
        record_date=delivered_date,
        data_source="real_order",
        source_file=None,
        source_record_key=f"real_order:{order_item.id}",
    )

    db.add(analytics_record)


def deliver_order(
    db: Session,
    *,
    order: CustomerOrder,
    changed_at: datetime,
) -> None:
    delivered_date = changed_at.date()

    if not order.items:
        raise HTTPException(
            status_code=409,
            detail=(
                "This order has no order items and cannot "
                "be marked as delivered."
            ),
        )

    # First update linked physical inventory.
    for order_item in order.items:
        if order_item.inventory_item is not None:
            mark_inventory_item_as_sold(
                db,
                inventory_item=order_item.inventory_item,
                order=order,
                changed_at=changed_at,
            )

    # Flush so inventory counts reflect sold items.
    db.flush()

    # Then generate one analytics record per order item.
    for order_item in order.items:
        create_analytics_record(
            db,
            order=order,
            order_item=order_item,
            delivered_date=delivered_date,
        )

    order.delivered_at = changed_at
    order.balance_due = Decimal("0.00")


def update_order_status(
    db: Session,
    *,
    order_id: uuid.UUID,
    payload: CustomerOrderStatusUpdate,
) -> CustomerOrder:
    order = load_order_with_items(db, order_id)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found.",
        )

    previous_status = order.status
    new_status = payload.status
    changed_at = utc_now()

    # Calling delivered again is treated as idempotent.
    if (
        previous_status == "delivered"
        and new_status == "delivered"
    ):
        append_order_note(order, payload.note)
        order.updated_at = changed_at
        return order

    # Reversing a delivered order requires a separate
    # return/refund workflow because inventory and analytics
    # have already been generated.
    if (
        previous_status == "delivered"
        and new_status != "delivered"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "A delivered order cannot be changed directly "
                "to another status. Use a return or refund "
                "workflow instead."
            ),
        )

    if new_status == "delivered":
        deliver_order(
            db,
            order=order,
            changed_at=changed_at,
        )

    order.status = new_status
    order.updated_at = changed_at
    append_order_note(order, payload.note)

    return order