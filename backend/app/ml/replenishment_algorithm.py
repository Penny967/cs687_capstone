from __future__ import annotations

from dataclasses import asdict, dataclass
from math import ceil
from typing import Any

import numpy as np
import pandas as pd


DEFAULT_DEMAND_PERIOD_DAYS = 30
DEFAULT_LEAD_TIME_DAYS = 60
DEFAULT_SAFETY_STOCK_DAYS = 14
DEFAULT_MINIMUM_ORDER_QUANTITY = 1

REQUIRED_INPUT_COLUMNS = {
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
    "delivery_days",
    "predicted_period_sales",
    "local_warehouse",
    "showroom",
    "reserved_inventory",
    "in_production",
    "in_transit",
}


@dataclass(frozen=True)
class ReplenishmentParameters:
    demand_period_days: int = DEFAULT_DEMAND_PERIOD_DAYS
    lead_time_days: int = DEFAULT_LEAD_TIME_DAYS
    safety_stock_days: int = DEFAULT_SAFETY_STOCK_DAYS
    minimum_order_quantity: int = DEFAULT_MINIMUM_ORDER_QUANTITY

    include_in_production_as_incoming: bool = True
    include_in_transit_as_incoming: bool = True

    urgent_gap_threshold: float = 5.0
    high_priority_threshold: float = 0.75
    medium_priority_threshold: float = 0.35


@dataclass(frozen=True)
class ReplenishmentRecommendationResult:
    product_id: str
    sku: str
    product_name: str

    category: str
    material: str
    color: str
    location: str
    store_type: str
    season: str

    price: float
    cost: float
    profit_margin: float

    current_inventory: int
    available_inventory: int
    reserved_inventory: int
    incoming_inventory: int
    inventory_supply: int

    predicted_period_sales: float
    predicted_daily_sales: float
    forecasted_demand_during_lead_time: float

    average_delivery_days: float
    effective_lead_time_days: float

    safety_stock: float
    reorder_point: float
    reorder_gap: float

    predicted_inventory_sales_ratio: float

    reorder_recommended: bool
    suggested_reorder_quantity: int
    replenishment_priority_score: float

    replenishment_decision: str
    risk_level: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_parameters(
    parameters: ReplenishmentParameters,
) -> None:
    if parameters.demand_period_days <= 0:
        raise ValueError(
            "demand_period_days must be greater than zero."
        )

    if parameters.lead_time_days <= 0:
        raise ValueError(
            "lead_time_days must be greater than zero."
        )

    if parameters.safety_stock_days < 0:
        raise ValueError(
            "safety_stock_days cannot be negative."
        )

    if parameters.minimum_order_quantity < 1:
        raise ValueError(
            "minimum_order_quantity must be at least 1."
        )

    if parameters.urgent_gap_threshold < 0:
        raise ValueError(
            "urgent_gap_threshold cannot be negative."
        )


def validate_input_dataframe(
    dataframe: pd.DataFrame,
) -> None:
    if dataframe.empty:
        raise ValueError(
            "Replenishment input contains no rows."
        )

    missing_columns = (
        REQUIRED_INPUT_COLUMNS - set(dataframe.columns)
    )

    if missing_columns:
        raise ValueError(
            "Replenishment input is missing required columns: "
            + ", ".join(sorted(missing_columns))
        )


def normalize_text(
    value: object,
    default: str = "Unknown",
) -> str:
    if pd.isna(value):
        return default

    normalized = str(value).strip()

    return normalized if normalized else default


def normalize_non_negative_float(
    value: object,
    default: float = 0.0,
) -> float:
    try:
        parsed_value = float(value)
    except (TypeError, ValueError):
        return default

    if not np.isfinite(parsed_value):
        return default

    return max(0.0, parsed_value)


def normalize_non_negative_int(
    value: object,
    default: int = 0,
) -> int:
    parsed_value = normalize_non_negative_float(
        value,
        float(default),
    )

    return max(0, int(round(parsed_value)))


def calculate_profit_margin(
    price: float,
    cost: float,
) -> float:
    if price <= 0:
        return 0.0

    return round(
        max(0.0, (price - cost) / price),
        4,
    )


def calculate_effective_lead_time(
    delivery_days: float,
    configured_lead_time_days: int,
) -> float:
    if delivery_days > 0:
        return delivery_days

    return float(configured_lead_time_days)


def calculate_priority_score(
    *,
    reorder_gap: float,
    reorder_point: float,
    inventory_supply: int,
    predicted_period_sales: float,
    effective_lead_time_days: float,
    profit_margin: float,
) -> float:
    """
    Generate an explainable score between 0 and 1.

    Components:
    - shortage severity
    - inventory coverage pressure
    - lead-time pressure
    - profit contribution
    """
    shortage_severity = (
        reorder_gap / reorder_point
        if reorder_point > 0
        else 0.0
    )

    shortage_severity = min(
        max(shortage_severity, 0.0),
        1.0,
    )

    if predicted_period_sales > 0:
        inventory_coverage_pressure = max(
            0.0,
            1.0
            - (
                inventory_supply
                / predicted_period_sales
            ),
        )
    else:
        inventory_coverage_pressure = 0.0

    inventory_coverage_pressure = min(
        inventory_coverage_pressure,
        1.0,
    )

    lead_time_pressure = min(
        effective_lead_time_days / 90.0,
        1.0,
    )

    normalized_profit_margin = min(
        max(profit_margin, 0.0),
        1.0,
    )

    priority_score = (
        0.45 * shortage_severity
        + 0.25 * inventory_coverage_pressure
        + 0.20 * lead_time_pressure
        + 0.10 * normalized_profit_margin
    )

    return round(
        min(max(priority_score, 0.0), 1.0),
        4,
    )


def determine_decision(
    *,
    reorder_gap: float,
    suggested_reorder_quantity: int,
    predicted_inventory_sales_ratio: float,
    priority_score: float,
    parameters: ReplenishmentParameters,
) -> tuple[str, str]:
    """
    Return:
        replenishment_decision
        risk_level
    """
    if (
        reorder_gap >= parameters.urgent_gap_threshold
        or priority_score >= parameters.high_priority_threshold
    ):
        return (
            "Urgent Replenishment",
            "High",
        )

    if (
        reorder_gap > 0
        or (
            suggested_reorder_quantity > 0
            and priority_score
            >= parameters.medium_priority_threshold
        )
    ):
        return (
            "Consider Replenishment",
            "Medium",
        )

    if predicted_inventory_sales_ratio >= 3.0:
        return (
            "Reduce Future Purchasing",
            "Low",
        )

    if predicted_inventory_sales_ratio >= 2.0:
        return (
            "Slow Down Replenishment",
            "Low",
        )

    return (
        "Maintain Current Inventory",
        "Low",
    )


def build_reason(
    *,
    decision: str,
    predicted_period_sales: float,
    available_inventory: int,
    incoming_inventory: int,
    inventory_supply: int,
    reorder_point: float,
    reorder_gap: float,
    suggested_reorder_quantity: int,
    effective_lead_time_days: float,
) -> str:
    if decision == "Urgent Replenishment":
        return (
            f"Predicted demand is {predicted_period_sales:.1f} units, "
            f"while total inventory supply is {inventory_supply} units. "
            f"The reorder point is {reorder_point:.1f}, creating a "
            f"shortage gap of {reorder_gap:.1f}. Reorder "
            f"{suggested_reorder_quantity} unit(s) as soon as possible."
        )

    if decision == "Consider Replenishment":
        return (
            f"Available inventory is {available_inventory} unit(s) and "
            f"incoming inventory is {incoming_inventory} unit(s). "
            f"With an effective lead time of "
            f"{effective_lead_time_days:.1f} days, the calculated "
            f"reorder gap is {reorder_gap:.1f}. Consider ordering "
            f"{suggested_reorder_quantity} unit(s)."
        )

    if decision == "Slow Down Replenishment":
        return (
            f"Current and incoming inventory provide relatively high "
            f"coverage compared with predicted demand of "
            f"{predicted_period_sales:.1f} units. Delay additional "
            f"purchasing until inventory levels decline."
        )

    if decision == "Reduce Future Purchasing":
        return (
            f"Inventory supply substantially exceeds predicted demand "
            f"of {predicted_period_sales:.1f} units. Reduce future "
            f"purchase quantities to avoid overstock."
        )

    return (
        f"Inventory supply is sufficient for predicted demand of "
        f"{predicted_period_sales:.1f} units. No additional reorder "
        f"is currently required."
    )


def calculate_recommendation_for_row(
    row: pd.Series,
    parameters: ReplenishmentParameters,
) -> ReplenishmentRecommendationResult:
    price = normalize_non_negative_float(row["price"])
    cost = normalize_non_negative_float(row["cost"])

    predicted_period_sales = normalize_non_negative_float(
        row["predicted_period_sales"]
    )

    delivery_days = normalize_non_negative_float(
        row["delivery_days"]
    )

    local_warehouse = normalize_non_negative_int(
        row["local_warehouse"]
    )

    showroom = normalize_non_negative_int(
        row["showroom"]
    )

    reserved_inventory = normalize_non_negative_int(
        row["reserved_inventory"]
    )

    in_production = normalize_non_negative_int(
        row["in_production"]
    )

    in_transit = normalize_non_negative_int(
        row["in_transit"]
    )

    current_inventory = local_warehouse + showroom

    available_inventory = max(
        0,
        current_inventory - reserved_inventory,
    )

    incoming_inventory = 0

    if parameters.include_in_production_as_incoming:
        incoming_inventory += in_production

    if parameters.include_in_transit_as_incoming:
        incoming_inventory += in_transit

    inventory_supply = (
        available_inventory + incoming_inventory
    )

    predicted_daily_sales = (
        predicted_period_sales
        / parameters.demand_period_days
    )

    effective_lead_time_days = (
        calculate_effective_lead_time(
            delivery_days,
            parameters.lead_time_days,
        )
    )

    forecasted_demand_during_lead_time = (
        predicted_daily_sales
        * effective_lead_time_days
    )

    safety_stock = (
        predicted_daily_sales
        * parameters.safety_stock_days
    )

    reorder_point = (
        forecasted_demand_during_lead_time
        + safety_stock
    )

    reorder_gap = max(
        0.0,
        reorder_point - inventory_supply,
    )

    if predicted_period_sales > 0:
        predicted_inventory_sales_ratio = (
            inventory_supply
            / predicted_period_sales
        )
    elif inventory_supply > 0:
        predicted_inventory_sales_ratio = float(
            inventory_supply
        )
    else:
        predicted_inventory_sales_ratio = 0.0

    reorder_recommended = reorder_gap > 0

    suggested_reorder_quantity = 0

    if reorder_recommended:
        suggested_reorder_quantity = max(
            parameters.minimum_order_quantity,
            ceil(reorder_gap),
        )

    profit_margin = calculate_profit_margin(
        price,
        cost,
    )

    priority_score = calculate_priority_score(
        reorder_gap=reorder_gap,
        reorder_point=reorder_point,
        inventory_supply=inventory_supply,
        predicted_period_sales=predicted_period_sales,
        effective_lead_time_days=effective_lead_time_days,
        profit_margin=profit_margin,
    )

    decision, risk_level = determine_decision(
        reorder_gap=reorder_gap,
        suggested_reorder_quantity=(
            suggested_reorder_quantity
        ),
        predicted_inventory_sales_ratio=(
            predicted_inventory_sales_ratio
        ),
        priority_score=priority_score,
        parameters=parameters,
    )

    reason = build_reason(
        decision=decision,
        predicted_period_sales=predicted_period_sales,
        available_inventory=available_inventory,
        incoming_inventory=incoming_inventory,
        inventory_supply=inventory_supply,
        reorder_point=reorder_point,
        reorder_gap=reorder_gap,
        suggested_reorder_quantity=(
            suggested_reorder_quantity
        ),
        effective_lead_time_days=effective_lead_time_days,
    )

    return ReplenishmentRecommendationResult(
        product_id=normalize_text(
            row["product_id"],
            "",
        ),
        sku=normalize_text(row["sku"]),
        product_name=normalize_text(
            row["product_name"]
        ),
        category=normalize_text(row["category"]),
        material=normalize_text(row["material"]),
        color=normalize_text(row["color"]),
        location=normalize_text(row["location"]),
        store_type=normalize_text(row["store_type"]),
        season=normalize_text(row["season"]),
        price=round(price, 2),
        cost=round(cost, 2),
        profit_margin=profit_margin,
        current_inventory=current_inventory,
        available_inventory=available_inventory,
        reserved_inventory=reserved_inventory,
        incoming_inventory=incoming_inventory,
        inventory_supply=inventory_supply,
        predicted_period_sales=round(
            predicted_period_sales,
            4,
        ),
        predicted_daily_sales=round(
            predicted_daily_sales,
            4,
        ),
        forecasted_demand_during_lead_time=round(
            forecasted_demand_during_lead_time,
            4,
        ),
        average_delivery_days=round(
            delivery_days,
            2,
        ),
        effective_lead_time_days=round(
            effective_lead_time_days,
            2,
        ),
        safety_stock=round(safety_stock, 4),
        reorder_point=round(reorder_point, 4),
        reorder_gap=round(reorder_gap, 4),
        predicted_inventory_sales_ratio=round(
            predicted_inventory_sales_ratio,
            4,
        ),
        reorder_recommended=reorder_recommended,
        suggested_reorder_quantity=(
            suggested_reorder_quantity
        ),
        replenishment_priority_score=(
            priority_score
        ),
        replenishment_decision=decision,
        risk_level=risk_level,
        reason=reason,
    )


def build_replenishment_recommendations(
    dataframe: pd.DataFrame,
    *,
    parameters: ReplenishmentParameters | None = None,
) -> pd.DataFrame:
    """
    Build replenishment recommendations for every input row.

    The input DataFrame should contain one consolidated row per SKU
    or SKU-location combination.
    """
    active_parameters = (
        parameters or ReplenishmentParameters()
    )

    validate_parameters(active_parameters)
    validate_input_dataframe(dataframe)

    recommendations = [
        calculate_recommendation_for_row(
            row,
            active_parameters,
        ).to_dict()
        for _, row in dataframe.iterrows()
    ]

    result = pd.DataFrame(recommendations)

    risk_order = {
        "High": 0,
        "Medium": 1,
        "Low": 2,
    }

    decision_order = {
        "Urgent Replenishment": 0,
        "Consider Replenishment": 1,
        "Maintain Current Inventory": 2,
        "Slow Down Replenishment": 3,
        "Reduce Future Purchasing": 4,
    }

    result["_risk_order"] = (
        result["risk_level"]
        .map(risk_order)
        .fillna(99)
    )

    result["_decision_order"] = (
        result["replenishment_decision"]
        .map(decision_order)
        .fillna(99)
    )

    result = (
        result.sort_values(
            by=[
                "_risk_order",
                "replenishment_priority_score",
                "_decision_order",
                "suggested_reorder_quantity",
                "sku",
            ],
            ascending=[
                True,
                False,
                True,
                False,
                True,
            ],
        )
        .drop(
            columns=[
                "_risk_order",
                "_decision_order",
            ]
        )
        .reset_index(drop=True)
    )

    return result