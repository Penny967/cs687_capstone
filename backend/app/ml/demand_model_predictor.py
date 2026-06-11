from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.replenishment import MLModelRun


@dataclass(frozen=True)
class ActiveDemandModel:
    model_run_id: str
    model_name: str
    model_type: str
    model_path: str

    feature_columns: list[str]
    categorical_features: list[str]
    numeric_features: list[str]

    pipeline: Any
    metrics: dict[str, float]


@dataclass(frozen=True)
class DemandPredictionResult:
    model_run_id: str
    predictions: list[float]
    row_count: int


def get_active_model_run(
    db: Session,
) -> MLModelRun:
    """
    Return the most recently trained active demand model.
    """
    statement = (
        select(MLModelRun)
        .where(MLModelRun.is_active.is_(True))
        .order_by(MLModelRun.trained_at.desc())
        .limit(1)
    )

    model_run = db.scalar(statement)

    if model_run is None:
        raise ValueError(
            "No active demand model was found. "
            "Train the demand model before generating predictions."
        )

    return model_run


def resolve_model_path(
    model_path: str,
) -> Path:
    """
    Resolve and validate the saved Joblib model path.
    """
    path = Path(model_path).expanduser().resolve()

    if not path.exists():
        raise FileNotFoundError(
            f"Demand model artifact was not found: {path}"
        )

    if not path.is_file():
        raise ValueError(
            f"Demand model path is not a file: {path}"
        )

    if path.suffix.lower() != ".joblib":
        raise ValueError(
            "Demand model artifact must be a .joblib file."
        )

    return path


def load_active_demand_model(
    db: Session,
) -> ActiveDemandModel:
    """
    Read the active MLModelRun and load its saved model artifact.
    """
    model_run = get_active_model_run(db)
    model_path = resolve_model_path(model_run.model_path)

    artifact = joblib.load(model_path)

    if not isinstance(artifact, dict):
        raise ValueError(
            "The demand model artifact has an invalid format."
        )

    required_artifact_keys = {
        "pipeline",
        "model_run_id",
        "model_name",
        "model_type",
        "feature_columns",
        "categorical_features",
        "numeric_features",
        "metrics",
    }

    missing_keys = required_artifact_keys - set(artifact.keys())

    if missing_keys:
        raise ValueError(
            "Demand model artifact is missing required values: "
            + ", ".join(sorted(missing_keys))
        )

    artifact_model_run_id = str(artifact["model_run_id"])

    if artifact_model_run_id != str(model_run.id):
        raise ValueError(
            "The active database model run does not match "
            "the saved model artifact."
        )

    return ActiveDemandModel(
        model_run_id=str(model_run.id),
        model_name=str(artifact["model_name"]),
        model_type=str(artifact["model_type"]),
        model_path=str(model_path),
        feature_columns=list(artifact["feature_columns"]),
        categorical_features=list(
            artifact["categorical_features"]
        ),
        numeric_features=list(artifact["numeric_features"]),
        pipeline=artifact["pipeline"],
        metrics={
            key: float(value)
            for key, value in dict(
                artifact["metrics"]
            ).items()
        },
    )


def validate_prediction_dataframe(
    dataframe: pd.DataFrame,
    model: ActiveDemandModel,
) -> pd.DataFrame:
    """
    Validate and normalize the prediction input.

    The fitted Pipeline handles categorical encoding and missing-value
    imputation, but the required input columns must still be present.
    """
    if dataframe.empty:
        raise ValueError(
            "Prediction input contains no rows."
        )

    missing_columns = (
        set(model.feature_columns) - set(dataframe.columns)
    )

    if missing_columns:
        raise ValueError(
            "Prediction input is missing required features: "
            + ", ".join(sorted(missing_columns))
        )

    prepared = dataframe.copy()

    for column in model.categorical_features:
        prepared[column] = (
            prepared[column]
            .fillna("Unknown")
            .astype(str)
            .str.strip()
            .replace("", "Unknown")
        )

    for column in model.numeric_features:
        prepared[column] = pd.to_numeric(
            prepared[column],
            errors="coerce",
        )

    return prepared[model.feature_columns]


def predict_demand(
    db: Session,
    dataframe: pd.DataFrame,
) -> DemandPredictionResult:
    """
    Predict period sales for each row using the active demand model.
    """
    model = load_active_demand_model(db)

    prepared = validate_prediction_dataframe(
        dataframe,
        model,
    )

    raw_predictions = model.pipeline.predict(prepared)

    cleaned_predictions = np.maximum(
        raw_predictions.astype(float),
        0.0,
    )

    predictions = [
        round(float(value), 4)
        for value in cleaned_predictions
    ]

    return DemandPredictionResult(
        model_run_id=model.model_run_id,
        predictions=predictions,
        row_count=len(predictions),
    )


def predict_demand_with_loaded_model(
    model: ActiveDemandModel,
    dataframe: pd.DataFrame,
) -> DemandPredictionResult:
    """
    Predict using an already-loaded model.

    Replenishment generation can call this function to avoid loading
    the same Joblib artifact multiple times during one request.
    """
    prepared = validate_prediction_dataframe(
        dataframe,
        model,
    )

    raw_predictions = model.pipeline.predict(prepared)

    cleaned_predictions = np.maximum(
        raw_predictions.astype(float),
        0.0,
    )

    return DemandPredictionResult(
        model_run_id=model.model_run_id,
        predictions=[
            round(float(value), 4)
            for value in cleaned_predictions
        ],
        row_count=len(cleaned_predictions),
    )