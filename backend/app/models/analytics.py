import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SalesAnalyticsRecord(Base):
    __tablename__ = "sales_analytics_records"

    __table_args__ = (
        UniqueConstraint(
            "order_item_id",
            name="unique_sales_record_per_order_item",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_orders.id"),
        nullable=False,
        index=True,
    )

    order_number: Mapped[str] = mapped_column(String(100), nullable=False)

    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customer_order_items.id"),
        nullable=False,
        index=True,
    )

    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id"),
        nullable=True,
        index=True,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id"),
        nullable=False,
        index=True,
    )

    sku: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)

    price: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    cost: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    sales: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    inventory: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    delivery_days: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    category: Mapped[str] = mapped_column(String(100), nullable=False)
    material: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=False)

    location: Mapped[str] = mapped_column(String(100), nullable=False)
    season: Mapped[str] = mapped_column(String(50), nullable=False)
    store_type: Mapped[str] = mapped_column(String(50), nullable=False)

    record_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    order = relationship(
        "CustomerOrder",
        back_populates="analytics_records",
    )

    order_item = relationship(
        "CustomerOrderItem",
        back_populates="analytics_record",
    )

    inventory_item = relationship(
        "InventoryItem",
        back_populates="analytics_records",
    )

    product = relationship(
        "Product",
        back_populates="analytics_records",
    )