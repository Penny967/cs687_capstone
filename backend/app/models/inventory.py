import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id"),
        nullable=False,
        index=True,
    )

    sku: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    location: Mapped[str] = mapped_column(String(100), nullable=False)

    store_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    condition: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="new",
    )

    batch_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    unit_cost: Mapped[float | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    expected_selling_price: Mapped[float | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )

    production_start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    estimated_arrival_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    actual_arrival_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    received_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    reserved_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    product = relationship(
        "Product",
        back_populates="inventory_items",
    )

    movements = relationship(
        "InventoryMovement",
        back_populates="inventory_item",
        cascade="all, delete-orphan",
    )

    order_items = relationship(
        "CustomerOrderItem",
        back_populates="inventory_item",
    )

    analytics_records = relationship(
        "SalesAnalyticsRecord",
        back_populates="inventory_item",
    )


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id"),
        nullable=False,
        index=True,
    )

    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)

    from_location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    to_location: Mapped[str | None] = mapped_column(String(100), nullable=True)

    movement_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    performed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    inventory_item = relationship(
        "InventoryItem",
        back_populates="movements",
    )