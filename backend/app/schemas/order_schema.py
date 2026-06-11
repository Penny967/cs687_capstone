import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CustomerOrderItemResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    product_id: uuid.UUID
    inventory_item_id: uuid.UUID | None

    sku: str
    product_name: str
    quantity: int

    unit_price: Decimal
    discount_amount: Decimal
    final_price: Decimal

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerOrderResponse(BaseModel):
    id: uuid.UUID
    order_number: str

    customer_name: str
    customer_phone: str | None

    status: str

    total_amount: Decimal
    deposit_amount: Decimal
    balance_due: Decimal

    scheduled_delivery_date: date | None
    delivered_at: datetime | None

    notes: str | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerOrderDetailResponse(CustomerOrderResponse):
    items: list[CustomerOrderItemResponse]


from typing import Literal


OrderStatus = Literal[
    "inquiry",
    "deposit_paid",
    "preparing",
    "scheduled_delivery",
    "delivered",
    "cancelled",
    "refunded",
]


class CustomerOrderStatusUpdate(BaseModel):
    status: OrderStatus
    note: str | None = None