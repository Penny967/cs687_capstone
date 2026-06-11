from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.analytics import SalesAnalyticsRecord
from app.models.replenishment import MLModelRun


MODEL_NAME = "furniture-demand-random-forest"
MODEL_TYPE = "RandomForestRegressor"
TARGET_COLUMN = "sales"

MINIMUM_TRAINING_ROWS = 30
TEST_SIZE = 0.20
RANDOM_STATE = 42

MODEL_ARTIFACT_DIRECTORY = (
    Path(__file__).resolve().parent / "model_artifacts"
)

CATEGORICAL_FEATURES = [
    "category",
    "material",
    "color",
    "location",
    "store_type",
    "season",
]

NUMERIC_FEATURES = [
    "price",
    "cost",
    "inventory",
    "delivery_days",
    "profit_margin",
    "cost_price_ratio",
]

FEATURE_COLUMNS = CATEGORICAL_FEATURES + NUMERIC_FEATURES


@dataclass(frozen=True)
class ModelTrainingResult:
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


def utc_now() -> datetime:
    """
    Return a timezone-naive UTC datetime.

    Existing project database columns use SQLAlchemy DateTime without
    timezone=True, so the timezone information is removed before storage.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def metric_decimal(value: float) -> Decimal:
    """
    Convert a floating-point model metric into a database-safe Decimal.
    """
    return Decimal(str(round(float(value), 4)))


def load_training_dataframe(
    db: Session,
    *,
    data_source: str | None = None,
) -> pd.DataFrame:
    """
    Read demand-model training columns from sales_analytics_records.

    When data_source is provided, only records from that source are used.
    Examples:
        simulated_csv
        real_order
    """
    statement = select(
        SalesAnalyticsRecord.id,
        SalesAnalyticsRecord.price,
        SalesAnalyticsRecord.cost,
        SalesAnalyticsRecord.sales,
        SalesAnalyticsRecord.inventory,
        SalesAnalyticsRecord.delivery_days,
        SalesAnalyticsRecord.category,
        SalesAnalyticsRecord.material,
        SalesAnalyticsRecord.color,
        SalesAnalyticsRecord.location,
        SalesAnalyticsRecord.season,
        SalesAnalyticsRecord.store_type,
        SalesAnalyticsRecord.data_source,
        SalesAnalyticsRecord.record_date,
    )

    if data_source is not None:
        statement = statement.where(
            SalesAnalyticsRecord.data_source == data_source
        )

    rows = db.execute(statement).mappings().all()

    if not rows:
        raise ValueError(
            "No sales analytics records were found for model training."
        )

    dataframe = pd.DataFrame([dict(row) for row in rows])

    return dataframe


def prepare_training_dataframe(
    dataframe: pd.DataFrame,
) -> pd.DataFrame:
    """
    Clean the raw database data and create derived model features.
    """
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
            "Training data is missing required columns: "
            + ", ".join(sorted(missing_columns))
        )

    prepared = dataframe.copy()

    numeric_columns = [
        "price",
        "cost",
        "sales",
        "inventory",
        "delivery_days",
    ]

    for column in numeric_columns:
        prepared[column] = pd.to_numeric(
            prepared[column],
            errors="coerce",
        )

    categorical_columns = [
        "category",
        "material",
        "color",
        "location",
        "season",
        "store_type",
    ]

    for column in categorical_columns:
        prepared[column] = (
            prepared[column]
            .fillna("Unknown")
            .astype(str)
            .str.strip()
            .replace("", "Unknown")
        )

    # The target must exist and must be non-negative.
    prepared = prepared.dropna(subset=[TARGET_COLUMN])
    prepared = prepared[prepared[TARGET_COLUMN] >= 0]

    # Remove clearly invalid financial and inventory observations.
    prepared = prepared[
        (prepared["price"].isna() | (prepared["price"] >= 0))
        & (prepared["cost"].isna() | (prepared["cost"] >= 0))
        & (
            prepared["inventory"].isna()
            | (prepared["inventory"] >= 0)
        )
        & (
            prepared["delivery_days"].isna()
            | (prepared["delivery_days"] >= 0)
        )
    ]

    # Unit profit margin:
    # (selling price - cost) / selling price
    prepared["profit_margin"] = np.where(
        prepared["price"] > 0,
        (
            prepared["price"] - prepared["cost"]
        ) / prepared["price"],
        0.0,
    )

    # Cost relative to selling price.
    prepared["cost_price_ratio"] = np.where(
        prepared["price"] > 0,
        prepared["cost"] / prepared["price"],
        0.0,
    )

    prepared["profit_margin"] = (
        prepared["profit_margin"]
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0.0)
    )

    prepared["cost_price_ratio"] = (
        prepared["cost_price_ratio"]
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0.0)
    )

    if len(prepared) < MINIMUM_TRAINING_ROWS:
        raise ValueError(
            "Insufficient training data. "
            f"At least {MINIMUM_TRAINING_ROWS} valid records are "
            f"required, but only {len(prepared)} were available."
        )

    if prepared[TARGET_COLUMN].nunique() < 2:
        raise ValueError(
            "The sales target contains only one unique value. "
            "A regression model cannot be meaningfully evaluated."
        )

    return prepared.reset_index(drop=True)


def build_demand_pipeline() -> Pipeline:
    """
    Build the preprocessing and Random Forest regression pipeline.
    """
    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent",
                ),
            ),
            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                ),
            ),
        ]
    )

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(
                    strategy="median",
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "categorical",
                categorical_pipeline,
                CATEGORICAL_FEATURES,
            ),
            (
                "numeric",
                numeric_pipeline,
                NUMERIC_FEATURES,
            ),
        ],
        remainder="drop",
    )

    demand_model = RandomForestRegressor(
        n_estimators=300,
        max_depth=None,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features="sqrt",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", demand_model),
        ]
    )


def extract_feature_importances(
    pipeline: Pipeline,
    *,
    top_n: int = 20,
) -> list[dict[str, float]]:
    """
    Return the most influential encoded features from the fitted model.
    """
    preprocessor = pipeline.named_steps["preprocessor"]
    model = pipeline.named_steps["model"]

    try:
        transformed_feature_names = (
            preprocessor.get_feature_names_out()
        )
    except Exception:
        return []

    importances = model.feature_importances_

    if len(transformed_feature_names) != len(importances):
        return []

    feature_importance_pairs = sorted(
        zip(
            transformed_feature_names,
            importances,
            strict=True,
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    return [
        {
            "feature": str(feature_name),
            "importance": round(float(importance), 6),
        }
        for feature_name, importance in feature_importance_pairs[
            :top_n
        ]
    ]


def save_model_artifact(
    *,
    pipeline: Pipeline,
    model_run_id: uuid.UUID,
    trained_at: datetime,
    metrics: dict[str, float],
    top_feature_importances: list[dict[str, float]],
) -> Path:
    """
    Persist the fitted pipeline and its metadata as one joblib artifact.
    """
    MODEL_ARTIFACT_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    timestamp = trained_at.strftime("%Y%m%d_%H%M%S")

    artifact_path = (
        MODEL_ARTIFACT_DIRECTORY
        / (
            f"demand_model_{timestamp}_"
            f"{str(model_run_id)[:8]}.joblib"
        )
    )

    artifact: dict[str, Any] = {
        "pipeline": pipeline,
        "model_run_id": str(model_run_id),
        "model_name": MODEL_NAME,
        "model_type": MODEL_TYPE,
        "target_column": TARGET_COLUMN,
        "feature_columns": FEATURE_COLUMNS,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "metrics": metrics,
        "top_feature_importances": top_feature_importances,
        "trained_at": trained_at.isoformat(),
        "sklearn_random_state": RANDOM_STATE,
    }

    joblib.dump(
        artifact,
        artifact_path,
        compress=3,
    )

    return artifact_path


def train_demand_model(
    db: Session,
    *,
    data_source: str | None = None,
) -> ModelTrainingResult:
    """
    Train, evaluate, save, and register a demand prediction model.

    The database transaction is committed only after both the model
    artifact and MLModelRun record are successfully created.
    """
    raw_dataframe = load_training_dataframe(
        db,
        data_source=data_source,
    )

    training_dataframe = prepare_training_dataframe(
        raw_dataframe
    )

    features = training_dataframe[FEATURE_COLUMNS]
    target = training_dataframe[TARGET_COLUMN].astype(float)

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
    )

    pipeline = build_demand_pipeline()
    pipeline.fit(x_train, y_train)

    predictions = pipeline.predict(x_test)

    mae = float(
        mean_absolute_error(
            y_test,
            predictions,
        )
    )

    rmse = float(
        np.sqrt(
            mean_squared_error(
                y_test,
                predictions,
            )
        )
    )

    r2 = float(
        r2_score(
            y_test,
            predictions,
        )
    )

    metrics = {
        "mae": mae,
        "rmse": rmse,
        "r2": r2,
    }

    top_feature_importances = extract_feature_importances(
        pipeline
    )

    model_run_id = uuid.uuid4()
    trained_at = utc_now()

    artifact_path: Path | None = None

    try:
        artifact_path = save_model_artifact(
            pipeline=pipeline,
            model_run_id=model_run_id,
            trained_at=trained_at,
            metrics=metrics,
            top_feature_importances=top_feature_importances,
        )

        # Only the latest successful run should be active.
        db.execute(
            update(MLModelRun)
            .where(MLModelRun.is_active.is_(True))
            .values(is_active=False)
        )

        model_run = MLModelRun(
            id=model_run_id,
            model_name=MODEL_NAME,
            model_type=MODEL_TYPE,
            target_column=TARGET_COLUMN,
            training_row_count=len(training_dataframe),
            feature_columns=FEATURE_COLUMNS,
            mae=metric_decimal(mae),
            rmse=metric_decimal(rmse),
            r2=metric_decimal(r2),
            model_path=str(artifact_path),
            is_active=True,
            trained_at=trained_at,
        )

        db.add(model_run)
        db.commit()

    except Exception:
        db.rollback()

        # Avoid leaving an unregistered model file if database storage fails.
        if artifact_path is not None and artifact_path.exists():
            artifact_path.unlink()

        raise

    return ModelTrainingResult(
        model_run_id=str(model_run_id),
        model_name=MODEL_NAME,
        model_type=MODEL_TYPE,
        target_column=TARGET_COLUMN,
        training_row_count=len(training_dataframe),
        training_set_row_count=len(x_train),
        test_set_row_count=len(x_test),
        mae=round(mae, 4),
        rmse=round(rmse, 4),
        r2=round(r2, 4),
        model_path=str(artifact_path),
        trained_at=trained_at.isoformat(),
        feature_columns=list(FEATURE_COLUMNS),
        categorical_features=list(CATEGORICAL_FEATURES),
        numeric_features=list(NUMERIC_FEATURES),
        top_feature_importances=top_feature_importances,
    )


def run_training_from_command_line() -> None:
    """
    Train the model directly from the terminal.
    """
    db = SessionLocal()

    try:
        result = train_demand_model(db)

        print("Demand model training completed successfully.")
        print(f"Model run ID: {result.model_run_id}")
        print(f"Training rows: {result.training_row_count}")
        print(
            "Train/test rows: "
            f"{result.training_set_row_count}/"
            f"{result.test_set_row_count}"
        )
        print(f"MAE: {result.mae}")
        print(f"RMSE: {result.rmse}")
        print(f"R²: {result.r2}")
        print(f"Model artifact: {result.model_path}")

        print("\nTop feature importances:")

        for item in result.top_feature_importances[:10]:
            print(
                f"  {item['feature']}: "
                f"{item['importance']:.6f}"
            )

    except Exception as error:
        print("Demand model training failed.")
        print(f"Reason: {error}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    run_training_from_command_line()