from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.ml.demand_model_predictor import (
    ActiveDemandModel,
    load_active_demand_model,
    predict_demand_with_loaded_model,
)
from app.ml.replenishment_algorithm import (
    ReplenishmentParameters,
    build_replenishment_recommendations,
)
from app.models.analytics import SalesAnalyticsRecord
from app.models.inventory import InventoryItem
from app.models.product import Product
from app.models.replenishment import (
    MLModelRun,
    ReplenishmentRecommendation,
)


@dataclass(frozen=True)
class ReplenishmentGenerationResult:
    model_run_id: str
    generated_count: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    total_suggested_quantity: int
    generated_at: str


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def current_season(current_date: date | None = None) -> str:
    active_date = current_date or date.today()
    month = active_date.month

    if month in {3, 4, 5}:
        return "Spring"

    if month in {6, 7, 8}:
        return "Summer"

    if month in {9, 10, 11}:
        return "Fall"

    return "Winter"


def safe_float(
    value: Any,
    default: float = 0.0,
) -> float:
    if value is None:
        return default

    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default

    if not np.isfinite(parsed):
        return default

    return parsed


def safe_non_negative_float(
    value: Any,
    default: float = 0.0,
) -> float:
    return max(0.0, safe_float(value, default))


def safe_non_negative_int(
    value: Any,
    default: int = 0,
) -> int:
    return max(
        0,
        int(round(safe_non_negative_float(value, float(default)))),
    )


def to_decimal(
    value: Any,
    decimal_places: int = 2,
) -> Decimal:
    numeric_value = safe_float(value)

    quantizer = (
        Decimal("0.0001")
        if decimal_places == 4
        else Decimal("0.01")
    )

    return Decimal(str(numeric_value)).quantize(quantizer)


def calculate_profit_margin(
    price: float,
    cost: float,
) -> float:
    if price <= 0:
        return 0.0

    return max(0.0, (price - cost) / price)


def calculate_cost_price_ratio(
    price: float,
    cost: float,
) -> float:
    if price <= 0:
        return 0.0

    return max(0.0, cost / price)


def load_analytics_dataframe(
    db: Session,
) -> pd.DataFrame:
    """
    Load historical analytics records used to construct the current
    demand-prediction input for each product.
    """
    statement = select(
        SalesAnalyticsRecord.product_id,
        SalesAnalyticsRecord.sku,
        SalesAnalyticsRecord.product_name,
        SalesAnalyticsRecord.category,
        SalesAnalyticsRecord.material,
        SalesAnalyticsRecord.color,
        SalesAnalyticsRecord.location,
        SalesAnalyticsRecord.store_type,
        SalesAnalyticsRecord.season,
        SalesAnalyticsRecord.price,
        SalesAnalyticsRecord.cost,
        SalesAnalyticsRecord.sales,
        SalesAnalyticsRecord.inventory,
        SalesAnalyticsRecord.delivery_days,
        SalesAnalyticsRecord.record_date,
    )

    rows = db.execute(statement).mappings().all()

    if not rows:
        raise ValueError(
            "No sales analytics records are available. "
            "Import historical data or deliver customer orders first."
        )

    return pd.DataFrame([dict(row) for row in rows])


def load_products_dataframe(
    db: Session,
) -> pd.DataFrame:
    statement = (
        select(
            Product.id.label("product_id"),
            Product.sku,
            Product.name.label("product_name"),
            Product.category,
            Product.material,
            Product.color,
            Product.default_price,
            Product.default_cost,
        )
        .where(Product.is_active.is_(True))
        .order_by(Product.sku)
    )

    rows = db.execute(statement).mappings().all()

    if not rows:
        raise ValueError(
            "No active products are available for replenishment."
        )

    return pd.DataFrame([dict(row) for row in rows])


def load_inventory_dataframe(
    db: Session,
) -> pd.DataFrame:
    statement = select(
        InventoryItem.product_id,
        InventoryItem.sku,
        InventoryItem.status,
        InventoryItem.location,
        InventoryItem.store_type,
    )

    rows = db.execute(statement).mappings().all()

    if not rows:
        return pd.DataFrame(
            columns=[
                "product_id",
                "sku",
                "status",
                "location",
                "store_type",
            ]
        )

    return pd.DataFrame([dict(row) for row in rows])


def aggregate_analytics_by_product(
    analytics_dataframe: pd.DataFrame,
) -> pd.DataFrame:
    """
    Convert historical analytics rows into one representative row for
    each product.

    Numeric values use historical averages. Text attributes use the
    latest available analytics record.
    """
    dataframe = analytics_dataframe.copy()

    numeric_columns = [
        "price",
        "cost",
        "sales",
        "inventory",
        "delivery_days",
    ]

    for column in numeric_columns:
        dataframe[column] = pd.to_numeric(
            dataframe[column],
            errors="coerce",
        )

    dataframe["record_date"] = pd.to_datetime(
        dataframe["record_date"],
        errors="coerce",
    )

    dataframe = dataframe.sort_values(
        by=["product_id", "record_date"],
        ascending=[True, True],
    )

    grouped_numeric = (
        dataframe.groupby(
            "product_id",
            dropna=False,
        )
        .agg(
            historical_average_price=("price", "mean"),
            historical_average_cost=("cost", "mean"),
            historical_average_sales=("sales", "mean"),
            historical_inventory=("inventory", "mean"),
            average_delivery_days=("delivery_days", "mean"),
            historical_record_count=("sku", "count"),
        )
        .reset_index()
    )

    latest_rows = (
        dataframe.groupby(
            "product_id",
            dropna=False,
            as_index=False,
        )
        .tail(1)[
            [
                "product_id",
                "location",
                "store_type",
                "season",
            ]
        ]
        .rename(
            columns={
                "location": "latest_location",
                "store_type": "latest_store_type",
                "season": "latest_season",
            }
        )
    )

    return grouped_numeric.merge(
        latest_rows,
        on="product_id",
        how="left",
    )


def aggregate_inventory_by_product(
    inventory_dataframe: pd.DataFrame,
) -> pd.DataFrame:
    """
    Count each multi-status inventory category for every product.
    """
    inventory_columns = [
        "product_id",
        "local_warehouse",
        "showroom",
        "reserved_inventory",
        "in_production",
        "in_transit",
        "sold",
        "damaged",
        "returned",
    ]

    if inventory_dataframe.empty:
        return pd.DataFrame(columns=inventory_columns)

    dataframe = inventory_dataframe.copy()

    recognized_statuses = {
        "local_warehouse",
        "showroom",
        "reserved",
        "in_production",
        "in_transit",
        "sold",
        "damaged",
        "returned",
    }

    dataframe["status"] = (
        dataframe["status"]
        .fillna("unknown")
        .astype(str)
        .str.strip()
        .str.lower()
    )

    dataframe.loc[
        ~dataframe["status"].isin(recognized_statuses),
        "status",
    ] = "unknown"

    status_counts = (
        dataframe.groupby(
            ["product_id", "status"],
            dropna=False,
        )
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )

    status_counts = status_counts.rename(
        columns={
            "reserved": "reserved_inventory",
        }
    )

    required_count_columns = [
        "local_warehouse",
        "showroom",
        "reserved_inventory",
        "in_production",
        "in_transit",
        "sold",
        "damaged",
        "returned",
    ]

    for column in required_count_columns:
        if column not in status_counts.columns:
            status_counts[column] = 0

    return status_counts[inventory_columns]


def build_replenishment_input_dataframe(
    db: Session,
) -> pd.DataFrame:
    """
    Build one model-ready row per active product.
    """
    products = load_products_dataframe(db)
    analytics = load_analytics_dataframe(db)
    inventory = load_inventory_dataframe(db)

    analytics_summary = aggregate_analytics_by_product(
        analytics
    )

    inventory_summary = aggregate_inventory_by_product(
        inventory
    )

    result = products.merge(
        analytics_summary,
        on="product_id",
        how="left",
    )

    result = result.merge(
        inventory_summary,
        on="product_id",
        how="left",
    )

    inventory_count_columns = [
        "local_warehouse",
        "showroom",
        "reserved_inventory",
        "in_production",
        "in_transit",
        "sold",
        "damaged",
        "returned",
    ]

    for column in inventory_count_columns:
        if column not in result.columns:
            result[column] = 0

        result[column] = (
            pd.to_numeric(
                result[column],
                errors="coerce",
            )
            .fillna(0)
            .clip(lower=0)
            .round()
            .astype(int)
        )

    result["price"] = (
        pd.to_numeric(
            result["historical_average_price"],
            errors="coerce",
        )
        .fillna(
            pd.to_numeric(
                result["default_price"],
                errors="coerce",
            )
        )
        .fillna(0.0)
    )

    result["cost"] = (
        pd.to_numeric(
            result["historical_average_cost"],
            errors="coerce",
        )
        .fillna(
            pd.to_numeric(
                result["default_cost"],
                errors="coerce",
            )
        )
        .fillna(0.0)
    )

    result["inventory"] = (
        result["local_warehouse"]
        + result["showroom"]
        - result["reserved_inventory"]
    ).clip(lower=0)

    result["delivery_days"] = (
        pd.to_numeric(
            result["average_delivery_days"],
            errors="coerce",
        )
        .fillna(60.0)
        .clip(lower=0)
    )

    result["location"] = (
        result["latest_location"]
        .fillna("Seattle")
        .astype(str)
        .replace("", "Seattle")
    )

    result["store_type"] = (
        result["latest_store_type"]
        .fillna("warehouse")
        .astype(str)
        .replace("", "warehouse")
    )

    result["season"] = current_season()

    result["profit_margin"] = result.apply(
        lambda row: calculate_profit_margin(
            safe_non_negative_float(row["price"]),
            safe_non_negative_float(row["cost"]),
        ),
        axis=1,
    )

    result["cost_price_ratio"] = result.apply(
        lambda row: calculate_cost_price_ratio(
            safe_non_negative_float(row["price"]),
            safe_non_negative_float(row["cost"]),
        ),
        axis=1,
    )

    required_columns = [
        "product_id",
        "sku",
        "product_name",
        "category",
        "material",
        "color",
        "location",
        "store_type",
        "season",
        "price",
        "cost",
        "inventory",
        "delivery_days",
        "profit_margin",
        "cost_price_ratio",
        "local_warehouse",
        "showroom",
        "reserved_inventory",
        "in_production",
        "in_transit",
    ]

    return result[required_columns].copy()


def add_demand_predictions(
    *,
    model: ActiveDemandModel,
    input_dataframe: pd.DataFrame,
) -> pd.DataFrame:
    prediction_result = predict_demand_with_loaded_model(
        model,
        input_dataframe,
    )

    if prediction_result.row_count != len(input_dataframe):
        raise ValueError(
            "Demand prediction count does not match the "
            "replenishment input row count."
        )

    result = input_dataframe.copy()

    result["predicted_period_sales"] = (
        prediction_result.predictions
    )

    return result


def clear_previous_pending_recommendations(
    db: Session,
) -> None:
    """
    Replace only pending recommendations.

    Reviewed, approved, rejected, or ordered history remains stored.
    """
    db.execute(
        delete(ReplenishmentRecommendation).where(
            ReplenishmentRecommendation.status == "pending"
        )
    )


def persist_recommendations(
    db: Session,
    *,
    model_run: MLModelRun,
    recommendations: pd.DataFrame,
    generated_at: datetime,
) -> list[ReplenishmentRecommendation]:
    created_records: list[ReplenishmentRecommendation] = []

    for row in recommendations.to_dict(orient="records"):
        recommendation = ReplenishmentRecommendation(
            model_run_id=model_run.id,
            product_id=uuid.UUID(str(row["product_id"])),
            sku=str(row["sku"]),
            product_name=str(row["product_name"]),
            category=str(row["category"]),
            material=str(row["material"]),
            color=str(row["color"]),
            location=str(row["location"]),
            store_type=str(row["store_type"]),
            season=str(row["season"]),
            price=to_decimal(row["price"]),
            cost=to_decimal(row["cost"]),
            current_inventory=safe_non_negative_int(
                row["current_inventory"]
            ),
            available_inventory=safe_non_negative_int(
                row["available_inventory"]
            ),
            incoming_inventory=safe_non_negative_int(
                row["incoming_inventory"]
            ),
            inventory_supply=safe_non_negative_int(
                row["inventory_supply"]
            ),
            predicted_period_sales=to_decimal(
                row["predicted_period_sales"]
            ),
            predicted_daily_sales=to_decimal(
                row["predicted_daily_sales"],
                decimal_places=4,
            ),
            forecasted_demand_during_lead_time=to_decimal(
                row["forecasted_demand_during_lead_time"]
            ),
            average_delivery_days=to_decimal(
                row["average_delivery_days"]
            ),
            safety_stock=to_decimal(
                row["safety_stock"]
            ),
            reorder_point=to_decimal(
                row["reorder_point"]
            ),
            reorder_gap=to_decimal(
                row["reorder_gap"]
            ),
            predicted_inventory_sales_ratio=to_decimal(
                row["predicted_inventory_sales_ratio"],
                decimal_places=4,
            ),
            suggested_reorder_quantity=safe_non_negative_int(
                row["suggested_reorder_quantity"]
            ),
            replenishment_priority_score=to_decimal(
                row["replenishment_priority_score"],
                decimal_places=4,
            ),
            replenishment_decision=str(
                row["replenishment_decision"]
            ),
            risk_level=str(row["risk_level"]),
            reason=str(row["reason"]),
            status="pending",
            generated_at=generated_at,
            reviewed_at=None,
        )

        db.add(recommendation)
        created_records.append(recommendation)

    return created_records


def generate_replenishment_recommendations(
    db: Session,
    *,
    parameters: ReplenishmentParameters | None = None,
) -> ReplenishmentGenerationResult:
    """
    Run the complete replenishment generation workflow.

    This function does not commit independently until all predictions
    and recommendation rows are ready.
    """
    active_parameters = (
        parameters or ReplenishmentParameters()
    )

    model = load_active_demand_model(db)

    model_run = db.get(
        MLModelRun,
        uuid.UUID(model.model_run_id),
    )

    if model_run is None:
        raise ValueError(
            "The active demand model run no longer exists "
            "in the database."
        )

    replenishment_input = (
        build_replenishment_input_dataframe(db)
    )

    prediction_input = add_demand_predictions(
        model=model,
        input_dataframe=replenishment_input,
    )

    recommendations = (
        build_replenishment_recommendations(
            prediction_input,
            parameters=active_parameters,
        )
    )

    generated_at = utc_now()

    try:
        clear_previous_pending_recommendations(db)

        created_records = persist_recommendations(
            db,
            model_run=model_run,
            recommendations=recommendations,
            generated_at=generated_at,
        )

        db.commit()

    except Exception:
        db.rollback()
        raise

    high_risk_count = int(
        (recommendations["risk_level"] == "High").sum()
    )

    medium_risk_count = int(
        (recommendations["risk_level"] == "Medium").sum()
    )

    low_risk_count = int(
        (recommendations["risk_level"] == "Low").sum()
    )

    total_suggested_quantity = int(
        recommendations[
            "suggested_reorder_quantity"
        ].sum()
    )

    return ReplenishmentGenerationResult(
        model_run_id=str(model_run.id),
        generated_count=len(created_records),
        high_risk_count=high_risk_count,
        medium_risk_count=medium_risk_count,
        low_risk_count=low_risk_count,
        total_suggested_quantity=(
            total_suggested_quantity
        ),
        generated_at=generated_at.isoformat(),
    )


def list_replenishment_recommendations(
    db: Session,
    *,
    risk_level: str | None = None,
    decision: str | None = None,
    recommendation_status: str | None = "pending",
    limit: int = 100,
    offset: int = 0,
) -> list[ReplenishmentRecommendation]:
    statement = select(ReplenishmentRecommendation)

    if risk_level:
        statement = statement.where(
            func.lower(
                ReplenishmentRecommendation.risk_level
            )
            == risk_level.strip().lower()
        )

    if decision:
        statement = statement.where(
            func.lower(
                ReplenishmentRecommendation
                .replenishment_decision
            )
            == decision.strip().lower()
        )

    if recommendation_status:
        statement = statement.where(
            func.lower(
                ReplenishmentRecommendation.status
            )
            == recommendation_status.strip().lower()
        )

    statement = (
        statement.order_by(
            ReplenishmentRecommendation
            .replenishment_priority_score.desc(),
            ReplenishmentRecommendation
            .suggested_reorder_quantity.desc(),
            ReplenishmentRecommendation.sku.asc(),
        )
        .offset(offset)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


def get_active_model_run(
    db: Session,
) -> MLModelRun | None:
    statement = (
        select(MLModelRun)
        .where(MLModelRun.is_active.is_(True))
        .order_by(MLModelRun.trained_at.desc())
        .limit(1)
    )

    return db.scalar(statement)