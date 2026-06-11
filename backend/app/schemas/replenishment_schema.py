import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DemandModelTrainingRequest(BaseModel):
    data_source: str | None = Field(
        default=None,
        max_length=50,
        description=(
            "Optional analytics source filter, such as "
            "'simulated_csv' or 'real_order'."
        ),
    )


class DemandModelTrainingResponse(BaseModel):
    model_run_id: str
    model_name: str
    model_type: str
    target_column: str

    training_row_count: int
    training_set_row_count: int
    test_set_row_count: int

    mae: float
    rmse: float
    r2: float

    model_path: str
    trained_at: str

    feature_columns: list[str]
    categorical_features: list[str]
    numeric_features: list[str]
    top_feature_importances: list[dict[str, float]]


class ReplenishmentGenerationRequest(BaseModel):
    demand_period_days: int = Field(
        default=30,
        ge=1,
        le=365,
    )

    lead_time_days: int = Field(
        default=60,
        ge=1,
        le=365,
    )

    safety_stock_days: int = Field(
        default=14,
        ge=0,
        le=365,
    )

    minimum_order_quantity: int = Field(
        default=1,
        ge=1,
        le=10000,
    )

    include_in_production_as_incoming: bool = True
    include_in_transit_as_incoming: bool = True

    urgent_gap_threshold: float = Field(
        default=5.0,
        ge=0,
    )

    high_priority_threshold: float = Field(
        default=0.75,
        ge=0,
        le=1,
    )

    medium_priority_threshold: float = Field(
        default=0.35,
        ge=0,
        le=1,
    )


class ReplenishmentGenerationResponse(BaseModel):
    model_run_id: str
    generated_count: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    total_suggested_quantity: int
    generated_at: str


class ReplenishmentRecommendationResponse(BaseModel):
    id: uuid.UUID
    model_run_id: uuid.UUID | None
    product_id: uuid.UUID

    sku: str
    product_name: str

    category: str | None
    material: str | None
    color: str | None
    location: str | None
    store_type: str | None
    season: str | None

    price: Decimal | None
    cost: Decimal | None

    current_inventory: int
    available_inventory: int
    incoming_inventory: int
    inventory_supply: int

    predicted_period_sales: Decimal | None
    predicted_daily_sales: Decimal | None
    forecasted_demand_during_lead_time: Decimal | None

    average_delivery_days: Decimal | None
    safety_stock: Decimal | None
    reorder_point: Decimal | None
    reorder_gap: Decimal | None

    predicted_inventory_sales_ratio: Decimal | None

    suggested_reorder_quantity: int
    replenishment_priority_score: Decimal | None

    replenishment_decision: str
    risk_level: str
    reason: str | None

    status: str
    generated_at: datetime
    reviewed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ActiveModelStatusResponse(BaseModel):
    available: bool

    model_run_id: uuid.UUID | None = None
    model_name: str | None = None
    model_type: str | None = None
    target_column: str | None = None

    training_row_count: int | None = None

    mae: Decimal | None = None
    rmse: Decimal | None = None
    r2: Decimal | None = None

    is_active: bool | None = None
    trained_at: datetime | None = None