from __future__ import annotations

import re
from datetime import date
from decimal import Decimal
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.analytics import SalesAnalyticsRecord
from app.models.product import Product


CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "Furniture_adjusted.csv"
SOURCE_FILE_NAME = CSV_PATH.name


def normalize_text(value: object) -> str:
    """Convert CSV values to a clean, normalized string."""
    if pd.isna(value):
        return "Unknown"

    text = str(value).strip()
    return text if text else "Unknown"


def slugify(value: str) -> str:
    """Convert text into a stable uppercase SKU segment."""
    normalized = re.sub(r"[^A-Za-z0-9]+", "-", value.strip())
    return normalized.strip("-").upper() or "UNKNOWN"


def build_sku(category: str, material: str, color: str) -> str:
    """
    Create one stable SKU for each unique product-attribute combination.

    Example:
    Bed + Wood + Blue -> BED-WOOD-BLUE
    """
    return "-".join(
        [
            slugify(category),
            slugify(material),
            slugify(color),
        ]
    )


def build_product_name(category: str, material: str, color: str) -> str:
    """Create a readable product name."""
    return f"{color} {material} {category}"


def to_decimal(value: object, field_name: str) -> Decimal:
    try:
        parsed = Decimal(str(value))
    except Exception as exc:
        raise ValueError(f"Invalid numeric value for {field_name}: {value}") from exc

    if parsed < 0:
        raise ValueError(f"{field_name} cannot be negative: {value}")

    return parsed


def to_non_negative_int(value: object, field_name: str) -> int:
    try:
        parsed = int(value)
    except Exception as exc:
        raise ValueError(f"Invalid integer value for {field_name}: {value}") from exc

    if parsed < 0:
        raise ValueError(f"{field_name} cannot be negative: {value}")

    return parsed


def get_or_create_product(
    db: Session,
    *,
    sku: str,
    product_name: str,
    category: str,
    material: str,
    color: str,
    default_price: Decimal,
    default_cost: Decimal,
) -> Product:
    existing_product = db.scalar(
        select(Product).where(Product.sku == sku)
    )

    if existing_product is not None:
        return existing_product

    product = Product(
        sku=sku,
        name=product_name,
        category=category,
        material=material,
        color=color,
        size=None,
        default_price=default_price,
        default_cost=default_cost,
        is_active=True,
    )

    db.add(product)
    db.flush()

    return product


def import_csv() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"CSV file not found: {CSV_PATH}. "
            "Place Furniture_adjusted.csv inside backend/data/."
        )

    dataframe = pd.read_csv(CSV_PATH)

    required_columns = {
        "price",
        "cost",
        "sales",
        "inventory",
        "delivery_days",
        "category",
        "material",
        "color",
        "location",
        "season",
        "store_type",
    }

    missing_columns = required_columns - set(dataframe.columns)

    if missing_columns:
        raise ValueError(
            "CSV is missing required columns: "
            + ", ".join(sorted(missing_columns))
        )

    created_products = 0
    created_records = 0
    skipped_records = 0
    failed_records = 0

    db = SessionLocal()

    try:
        for row_index, row in dataframe.iterrows():
            source_record_key = f"{SOURCE_FILE_NAME}:{row_index}"

            existing_record = db.scalar(
                select(SalesAnalyticsRecord).where(
                    SalesAnalyticsRecord.source_record_key
                    == source_record_key
                )
            )

            if existing_record is not None:
                skipped_records += 1
                continue

            try:
                category = normalize_text(row["category"])
                material = normalize_text(row["material"])
                color = normalize_text(row["color"])
                location = normalize_text(row["location"])
                season = normalize_text(row["season"])
                store_type = normalize_text(row["store_type"])

                price = to_decimal(row["price"], "price")
                cost = to_decimal(row["cost"], "cost")

                sales = to_non_negative_int(row["sales"], "sales")
                inventory = to_non_negative_int(
                    row["inventory"],
                    "inventory",
                )
                delivery_days = to_non_negative_int(
                    row["delivery_days"],
                    "delivery_days",
                )

                sku = build_sku(category, material, color)
                product_name = build_product_name(
                    category,
                    material,
                    color,
                )

                product_was_present = db.scalar(
                    select(Product.id).where(Product.sku == sku)
                )

                product = get_or_create_product(
                    db,
                    sku=sku,
                    product_name=product_name,
                    category=category,
                    material=material,
                    color=color,
                    default_price=price,
                    default_cost=cost,
                )

                if product_was_present is None:
                    created_products += 1

                analytics_record = SalesAnalyticsRecord(
                    order_id=None,
                    order_number=None,
                    order_item_id=None,
                    inventory_item_id=None,
                    product_id=product.id,
                    sku=sku,
                    product_name=product_name,
                    price=price,
                    cost=cost,
                    sales=sales,
                    inventory=inventory,
                    delivery_days=delivery_days,
                    category=category,
                    material=material,
                    color=color,
                    location=location,
                    season=season,
                    store_type=store_type,
                    record_date=date.today(),
                    data_source="simulated_csv",
                    source_file=SOURCE_FILE_NAME,
                    source_record_key=source_record_key,
                )

                db.add(analytics_record)
                created_records += 1

            except Exception as row_error:
                failed_records += 1
                print(
                    f"Skipping row {row_index} because of error: "
                    f"{row_error}"
                )

        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    print("CSV import completed.")
    print(f"Created products: {created_products}")
    print(f"Created analytics records: {created_records}")
    print(f"Skipped existing records: {skipped_records}")
    print(f"Failed records: {failed_records}")


if __name__ == "__main__":
    import_csv()