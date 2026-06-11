from __future__ import annotations

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models.replenishment import (
    ReplenishmentRecommendation,
)
from app.services.replenishment_service import (
    build_replenishment_input_dataframe,
    generate_replenishment_recommendations,
)


def run_test() -> None:
    db = SessionLocal()

    try:
        input_dataframe = (
            build_replenishment_input_dataframe(db)
        )

        print("Replenishment input prepared.")
        print(f"Products: {len(input_dataframe)}")

        print(
            input_dataframe[
                [
                    "sku",
                    "price",
                    "cost",
                    "inventory",
                    "delivery_days",
                    "local_warehouse",
                    "showroom",
                    "reserved_inventory",
                    "in_production",
                    "in_transit",
                ]
            ]
            .head(10)
            .to_string(index=False)
        )

        result = (
            generate_replenishment_recommendations(db)
        )

        print("\nRecommendations generated.")
        print(f"Model run ID: {result.model_run_id}")
        print(
            f"Generated count: {result.generated_count}"
        )
        print(
            f"High / Medium / Low: "
            f"{result.high_risk_count} / "
            f"{result.medium_risk_count} / "
            f"{result.low_risk_count}"
        )
        print(
            "Total suggested quantity: "
            f"{result.total_suggested_quantity}"
        )

        saved_count = db.scalar(
            select(
                func.count(
                    ReplenishmentRecommendation.id
                )
            ).where(
                ReplenishmentRecommendation.status
                == "pending"
            )
        )

        print(
            f"Pending records in database: {saved_count}"
        )

    finally:
        db.close()


if __name__ == "__main__":
    run_test()