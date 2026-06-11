from __future__ import annotations

import random
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.inventory import InventoryItem, InventoryMovement
from app.models.order import CustomerOrder, CustomerOrderItem
from app.models.product import Product


RANDOM_SEED = 687

PRODUCT_LIMIT = 30
ORDER_COUNT = 45

DEMO_ORDER_PREFIX = "DEMO-ORD-"
DEMO_BATCH_PREFIX = "DEMO-BATCH-"

INVENTORY_STATUS_WEIGHTS = {
    "local_warehouse": 35,
    "showroom": 20,
    "in_transit": 18,
    "in_production": 15,
    "reserved": 8,
    "damaged": 4,
}

ORDER_STATUS_WEIGHTS = {
    "inquiry": 15,
    "deposit_paid": 20,
    "preparing": 25,
    "scheduled_delivery": 20,
    "delivered": 20,
}

CUSTOMER_FIRST_NAMES = [
    "Emily",
    "Michael",
    "Sarah",
    "David",
    "Jessica",
    "Daniel",
    "Olivia",
    "James",
    "Sophia",
    "Ethan",
    "Grace",
    "William",
    "Ava",
    "Benjamin",
    "Mia",
]

CUSTOMER_LAST_NAMES = [
    "Johnson",
    "Chen",
    "Miller",
    "Lee",
    "Wilson",
    "Brown",
    "Taylor",
    "Anderson",
    "Thomas",
    "Martin",
    "Davis",
    "Clark",
    "Lewis",
    "Walker",
    "Hall",
]

STATUS_LOCATION_MAP = {
    "in_production": ("Foshan Factory", "factory"),
    "in_transit": ("Pacific Ocean Shipping", "in_transit"),
    "local_warehouse": ("Seattle Warehouse", "warehouse"),
    "showroom": ("Redmond Showroom", "showroom"),
    "reserved": ("Redmond Showroom", "showroom"),
    "damaged": ("Seattle Warehouse", "warehouse"),
    "sold": ("Customer Delivery", "other"),
}


def weighted_choice(weight_map: dict[str, int]) -> str:
    values = list(weight_map.keys())
    weights = list(weight_map.values())
    return random.choices(values, weights=weights, k=1)[0]


def random_customer_name() -> str:
    first_name = random.choice(CUSTOMER_FIRST_NAMES)
    last_name = random.choice(CUSTOMER_LAST_NAMES)
    return f"{first_name} {last_name}"


def random_phone() -> str:
    area_code = random.choice(["206", "425", "253"])
    return f"{area_code}-555-{random.randint(1000, 9999)}"


def money(value: Decimal | float | int) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def clear_existing_demo_data(db: Session) -> None:
    """
    Remove only previously generated demo records.

    CSV-derived products and analytics records remain untouched.
    """

    demo_order_ids = db.scalars(
        select(CustomerOrder.id).where(
            CustomerOrder.order_number.like(f"{DEMO_ORDER_PREFIX}%")
        )
    ).all()

    demo_inventory_ids = db.scalars(
        select(InventoryItem.id).where(
            InventoryItem.batch_number.like(f"{DEMO_BATCH_PREFIX}%")
        )
    ).all()

    if demo_order_ids:
        db.execute(
            delete(CustomerOrderItem).where(
                CustomerOrderItem.order_id.in_(demo_order_ids)
            )
        )

        db.execute(
            delete(CustomerOrder).where(
                CustomerOrder.id.in_(demo_order_ids)
            )
        )

    if demo_inventory_ids:
        db.execute(
            delete(InventoryMovement).where(
                InventoryMovement.inventory_item_id.in_(demo_inventory_ids)
            )
        )

        db.execute(
            delete(InventoryItem).where(
                InventoryItem.id.in_(demo_inventory_ids)
            )
        )

    db.flush()


def create_initial_movement(
    db: Session,
    inventory_item: InventoryItem,
) -> None:
    movement = InventoryMovement(
        inventory_item_id=inventory_item.id,
        from_status=None,
        to_status=inventory_item.status,
        from_location=None,
        to_location=inventory_item.location,
        movement_reason="Demo inventory record created.",
        performed_by=None,
        created_at=inventory_item.created_at,
    )

    db.add(movement)


def create_inventory_for_products(
    db: Session,
    products: list[Product],
) -> list[InventoryItem]:
    inventory_items: list[InventoryItem] = []
    today = date.today()

    for product_index, product in enumerate(products, start=1):
        item_count = random.randint(3, 6)

        for item_index in range(1, item_count + 1):
            status = weighted_choice(INVENTORY_STATUS_WEIGHTS)
            location, store_type = STATUS_LOCATION_MAP[status]

            production_start_date = today - timedelta(
                days=random.randint(40, 120)
            )

            estimated_arrival_date = production_start_date + timedelta(
                days=random.randint(45, 80)
            )

            actual_arrival_date: date | None = None
            received_date: date | None = None

            if status in {
                "local_warehouse",
                "showroom",
                "reserved",
                "damaged",
            }:
                actual_arrival_date = estimated_arrival_date + timedelta(
                    days=random.randint(-5, 12)
                )
                received_date = actual_arrival_date

            default_cost = money(product.default_cost)
            default_price = money(product.default_price)

            cost_variation = Decimal(
                str(random.uniform(0.92, 1.10))
            )
            price_variation = Decimal(
                str(random.uniform(0.95, 1.08))
            )

            condition = "new"

            if status == "showroom":
                condition = random.choice(["new", "display"])

            if status == "damaged":
                condition = "damaged"

            inventory_item = InventoryItem(
                product_id=product.id,
                sku=product.sku,
                status=status,
                location=location,
                store_type=store_type,
                condition=condition,
                batch_number=(
                    f"{DEMO_BATCH_PREFIX}"
                    f"{product_index:03d}-{item_index:02d}"
                ),
                unit_cost=money(default_cost * cost_variation),
                expected_selling_price=money(
                    default_price * price_variation
                ),
                production_start_date=production_start_date,
                estimated_arrival_date=estimated_arrival_date,
                actual_arrival_date=actual_arrival_date,
                received_date=received_date,
                notes=(
                    "Minor cosmetic damage found during inspection."
                    if status == "damaged"
                    else "Generated for capstone demo."
                ),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            db.add(inventory_item)
            db.flush()

            create_initial_movement(db, inventory_item)
            inventory_items.append(inventory_item)

    return inventory_items


def find_available_inventory(
    inventory_items: list[InventoryItem],
    product_id,
) -> InventoryItem | None:
    eligible_statuses = {
        "local_warehouse",
        "showroom",
    }

    matches = [
        item
        for item in inventory_items
        if item.product_id == product_id
        and item.status in eligible_statuses
    ]

    return random.choice(matches) if matches else None


def create_demo_orders(
    db: Session,
    products: list[Product],
    inventory_items: list[InventoryItem],
) -> list[CustomerOrder]:
    orders: list[CustomerOrder] = []
    today = date.today()

    for order_index in range(1, ORDER_COUNT + 1):
        order_status = weighted_choice(ORDER_STATUS_WEIGHTS)

        created_date = today - timedelta(
            days=random.randint(1, 120)
        )

        scheduled_delivery_date = created_date + timedelta(
            days=random.randint(5, 30)
        )

        delivered_at: datetime | None = None

        if order_status == "delivered":
            delivered_at = datetime.combine(
                scheduled_delivery_date,
                datetime.min.time(),
            )

        order = CustomerOrder(
            order_number=f"{DEMO_ORDER_PREFIX}{order_index:04d}",
            customer_name=random_customer_name(),
            customer_phone=random_phone(),
            status=order_status,
            total_amount=Decimal("0.00"),
            deposit_amount=Decimal("0.00"),
            balance_due=Decimal("0.00"),
            scheduled_delivery_date=scheduled_delivery_date,
            delivered_at=delivered_at,
            notes=random.choice(
                [
                    "Customer prefers weekend delivery.",
                    "Call customer before delivery.",
                    "Deliver through the garage entrance.",
                    "Customer requested assembly service.",
                    None,
                ]
            ),
            created_at=datetime.combine(
                created_date,
                datetime.min.time(),
            ),
            updated_at=datetime.utcnow(),
        )

        db.add(order)
        db.flush()

        number_of_order_items = random.choices(
            [1, 2, 3],
            weights=[60, 30, 10],
            k=1,
        )[0]

        selected_products = random.sample(
            products,
            k=min(number_of_order_items, len(products)),
        )

        order_total = Decimal("0.00")

        for selected_product in selected_products:
            quantity = random.choices(
                [1, 2, 4],
                weights=[70, 20, 10],
                k=1,
            )[0]

            unit_price = money(
                Decimal(str(selected_product.default_price))
                * Decimal(str(random.uniform(0.92, 1.05)))
            )

            discount_amount = money(
                unit_price
                * Decimal(str(random.choice([0, 0, 0.05, 0.10])))
                * quantity
            )

            final_price = money(
                unit_price * quantity - discount_amount
            )

            linked_inventory: InventoryItem | None = None

            if quantity == 1 and order_status not in {
                "inquiry",
                "cancelled",
            }:
                linked_inventory = find_available_inventory(
                    inventory_items,
                    selected_product.id,
                )

            order_item = CustomerOrderItem(
                order_id=order.id,
                product_id=selected_product.id,
                inventory_item_id=(
                    linked_inventory.id
                    if linked_inventory is not None
                    else None
                ),
                sku=selected_product.sku,
                product_name=selected_product.name,
                quantity=quantity,
                unit_price=unit_price,
                discount_amount=discount_amount,
                final_price=final_price,
                created_at=order.created_at,
            )

            db.add(order_item)
            order_total += final_price

            if linked_inventory is not None:
                previous_status = linked_inventory.status

                if order_status == "delivered":
                    new_inventory_status = "sold"
                    new_location = "Customer Delivery"
                    new_store_type = "other"
                    movement_reason = (
                        f"Sold through order {order.order_number}."
                    )
                else:
                    new_inventory_status = "reserved"
                    new_location = linked_inventory.location
                    new_store_type = linked_inventory.store_type
                    movement_reason = (
                        f"Reserved for order {order.order_number}."
                    )

                linked_inventory.status = new_inventory_status
                linked_inventory.location = new_location
                linked_inventory.store_type = new_store_type
                linked_inventory.reserved_order_id = order.id
                linked_inventory.updated_at = datetime.utcnow()

                movement = InventoryMovement(
                    inventory_item_id=linked_inventory.id,
                    from_status=previous_status,
                    to_status=new_inventory_status,
                    from_location=linked_inventory.location,
                    to_location=new_location,
                    movement_reason=movement_reason,
                    performed_by=None,
                    created_at=datetime.utcnow(),
                )

                db.add(movement)

        deposit_ratio = {
            "inquiry": Decimal("0.00"),
            "deposit_paid": Decimal("0.30"),
            "preparing": Decimal("0.40"),
            "scheduled_delivery": Decimal("0.50"),
            "delivered": Decimal("1.00"),
        }[order_status]

        deposit_amount = money(order_total * deposit_ratio)

        order.total_amount = money(order_total)
        order.deposit_amount = deposit_amount
        order.balance_due = (
            Decimal("0.00")
            if order_status == "delivered"
            else money(order_total - deposit_amount)
        )

        orders.append(order)

    return orders


def seed_demo_data() -> None:
    random.seed(RANDOM_SEED)

    db = SessionLocal()

    try:
        products = db.scalars(
            select(Product)
            .where(Product.is_active.is_(True))
            .order_by(Product.sku)
            .limit(PRODUCT_LIMIT)
        ).all()

        if not products:
            raise RuntimeError(
                "No products were found. Import Furniture_adjusted.csv "
                "before running the demo seed script."
            )

        clear_existing_demo_data(db)

        inventory_items = create_inventory_for_products(
            db,
            products,
        )

        orders = create_demo_orders(
            db,
            products,
            inventory_items,
        )

        db.commit()

        print("Demo data created successfully.")
        print(f"Products used: {len(products)}")
        print(f"Inventory items created: {len(inventory_items)}")
        print(f"Orders created: {len(orders)}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()