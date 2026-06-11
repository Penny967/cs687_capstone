from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.ml.demand_model_trainer import train_demand_model
from app.ml.replenishment_algorithm import (
    ReplenishmentParameters,
)
from app.schemas.replenishment_schema import (
    ActiveModelStatusResponse,
    DemandModelTrainingRequest,
    DemandModelTrainingResponse,
    ReplenishmentGenerationRequest,
    ReplenishmentGenerationResponse,
    ReplenishmentRecommendationResponse,
)
from app.services.replenishment_service import (
    generate_replenishment_recommendations,
    get_active_model_run,
    list_replenishment_recommendations,
)


router = APIRouter(
    prefix="/api/replenishment",
    tags=["Replenishment"],
)


@router.post(
    "/train-model",
    response_model=DemandModelTrainingResponse,
)
def train_replenishment_model(
    payload: DemandModelTrainingRequest,
    db: Session = Depends(get_db),
) -> DemandModelTrainingResponse:
    try:
        result = train_demand_model(
            db,
            data_source=payload.data_source,
        )

        return DemandModelTrainingResponse(
            model_run_id=result.model_run_id,
            model_name=result.model_name,
            model_type=result.model_type,
            target_column=result.target_column,
            training_row_count=result.training_row_count,
            training_set_row_count=(
                result.training_set_row_count
            ),
            test_set_row_count=result.test_set_row_count,
            mae=result.mae,
            rmse=result.rmse,
            r2=result.r2,
            model_path=result.model_path,
            trained_at=result.trained_at,
            feature_columns=result.feature_columns,
            categorical_features=(
                result.categorical_features
            ),
            numeric_features=result.numeric_features,
            top_feature_importances=(
                result.top_feature_importances
            ),
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error

    except SQLAlchemyError as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to store the trained model.",
        ) from error


@router.post(
    "/generate",
    response_model=ReplenishmentGenerationResponse,
)
def generate_recommendations(
    payload: ReplenishmentGenerationRequest,
    db: Session = Depends(get_db),
) -> ReplenishmentGenerationResponse:
    parameters = ReplenishmentParameters(
        demand_period_days=payload.demand_period_days,
        lead_time_days=payload.lead_time_days,
        safety_stock_days=payload.safety_stock_days,
        minimum_order_quantity=(
            payload.minimum_order_quantity
        ),
        include_in_production_as_incoming=(
            payload.include_in_production_as_incoming
        ),
        include_in_transit_as_incoming=(
            payload.include_in_transit_as_incoming
        ),
        urgent_gap_threshold=(
            payload.urgent_gap_threshold
        ),
        high_priority_threshold=(
            payload.high_priority_threshold
        ),
        medium_priority_threshold=(
            payload.medium_priority_threshold
        ),
    )

    try:
        result = generate_replenishment_recommendations(
            db,
            parameters=parameters,
        )

        return ReplenishmentGenerationResponse(
            model_run_id=result.model_run_id,
            generated_count=result.generated_count,
            high_risk_count=result.high_risk_count,
            medium_risk_count=(
                result.medium_risk_count
            ),
            low_risk_count=result.low_risk_count,
            total_suggested_quantity=(
                result.total_suggested_quantity
            ),
            generated_at=result.generated_at,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error

    except SQLAlchemyError as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate replenishment "
                "recommendations."
            ),
        ) from error


@router.get(
    "/recommendations",
    response_model=list[
        ReplenishmentRecommendationResponse
    ],
)
def get_recommendations(
    risk_level: str | None = Query(
        default=None,
        max_length=50,
    ),
    decision: str | None = Query(
        default=None,
        max_length=100,
    ),
    recommendation_status: str | None = Query(
        default="pending",
        alias="status",
        max_length=50,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
) -> list:
    return list_replenishment_recommendations(
        db,
        risk_level=risk_level,
        decision=decision,
        recommendation_status=(
            recommendation_status
        ),
        limit=limit,
        offset=offset,
    )


@router.get(
    "/model-status",
    response_model=ActiveModelStatusResponse,
)
def get_model_status(
    db: Session = Depends(get_db),
) -> ActiveModelStatusResponse:
    model_run = get_active_model_run(db)

    if model_run is None:
        return ActiveModelStatusResponse(
            available=False,
        )

    return ActiveModelStatusResponse(
        available=True,
        model_run_id=model_run.id,
        model_name=model_run.model_name,
        model_type=model_run.model_type,
        target_column=model_run.target_column,
        training_row_count=(
            model_run.training_row_count
        ),
        mae=model_run.mae,
        rmse=model_run.rmse,
        r2=model_run.r2,
        is_active=model_run.is_active,
        trained_at=model_run.trained_at,
    )