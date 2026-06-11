import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ALLOWED_INVENTORY_STATUSES = {
    "in_production",
    "in_transit",
    "local_warehouse",
    "showroom",
    "reserved",
    "sold",
    "damaged",
    "returned",
}

ALLOWED_STORE_TYPES = {
    "factory",
    "warehouse",
    "showroom",
    "in_transit",
    "online",
    "other",
}

ALLOWED_CONDITIONS = {
    "new",
    "display",
    "open_box",
    "damaged",
    "returned",
}


class InventoryMovementResponse(BaseModel):
    id: uuid.UUID
    inventory_item_id: uuid.UUID

    from_status: str | None
    to_status: str

    from_location: str | None
    to_location: str | None

    movement_reason: str | None
    performed_by: uuid.UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID

    sku: str
    status: str
    location: str
    store_type: str
    condition: str

    batch_number: str | None

    unit_cost: Decimal | None
    expected_selling_price: Decimal | None

    production_start_date: date | None
    estimated_arrival_date: date | None
    actual_arrival_date: date | None
    received_date: date | None

    reserved_order_id: uuid.UUID | None
    notes: str | None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemDetailResponse(InventoryItemResponse):
    product_name: str
    category: str
    material: str
    color: str


class InventoryItemCreate(BaseModel):
    product_id: uuid.UUID

    status: str
    location: str = Field(min_length=1, max_length=100)
    store_type: str
    condition: str = "new"

    batch_number: str | None = Field(
        default=None,
        max_length=100,
    )

    unit_cost: Decimal | None = Field(
        default=None,
        ge=0,
        decimal_places=2,
    )

    expected_selling_price: Decimal | None = Field(
        default=None,
        ge=0,
        decimal_places=2,
    )

    production_start_date: date | None = None
    estimated_arrival_date: date | None = None
    actual_arrival_date: date | None = None
    received_date: date | None = None

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )

    @model_validator(mode="after")
    def validate_inventory_values(self):
        if self.status not in ALLOWED_INVENTORY_STATUSES:
            raise ValueError("Invalid inventory status.")

        if self.store_type not in ALLOWED_STORE_TYPES:
            raise ValueError("Invalid store type.")

        if self.condition not in ALLOWED_CONDITIONS:
            raise ValueError("Invalid inventory condition.")

        if (
            self.production_start_date
            and self.actual_arrival_date
            and self.actual_arrival_date < self.production_start_date
        ):
            raise ValueError(
                "Actual arrival date cannot be earlier than "
                "production start date."
            )

        return self


class InventoryStatusUpdate(BaseModel):
    status: str

    location: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    store_type: str | None = None

    movement_reason: str | None = Field(
        default=None,
        max_length=2000,
    )

    @model_validator(mode="after")
    def validate_status_update(self):
        if self.status not in ALLOWED_INVENTORY_STATUSES:
            raise ValueError("Invalid inventory status.")

        if (
            self.store_type is not None
            and self.store_type not in ALLOWED_STORE_TYPES
        ):
            raise ValueError("Invalid store type.")

        return self