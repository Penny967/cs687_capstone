import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ProductResponse(BaseModel):
    id: uuid.UUID
    sku: str
    name: str
    category: str
    material: str
    color: str
    size: str | None

    default_price: Decimal
    default_cost: Decimal
    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)