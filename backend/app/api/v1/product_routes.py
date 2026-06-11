import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.schemas.product_schema import ProductResponse


router = APIRouter(
    prefix="/api/products",
    tags=["Products"],
)


@router.get("", response_model=list[ProductResponse])
def list_products(
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=100),
    is_active: bool | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Product]:
    statement = select(Product)

    if search:
        normalized_search = f"%{search.strip()}%"

        statement = statement.where(
            or_(
                Product.sku.ilike(normalized_search),
                Product.name.ilike(normalized_search),
                Product.material.ilike(normalized_search),
                Product.color.ilike(normalized_search),
            )
        )

    if category:
        statement = statement.where(
            func.lower(Product.category) == category.strip().lower()
        )

    if is_active is not None:
        statement = statement.where(Product.is_active == is_active)

    statement = (
        statement
        .order_by(Product.sku)
        .offset(offset)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> Product:
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    return product