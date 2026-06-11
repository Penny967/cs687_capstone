from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.inventory_routes import (
    router as inventory_router,
)
from app.api.v1.order_routes import (
    router as order_router,
)
from app.api.v1.product_routes import (
    router as product_router,
)
from app.api.v1.replenishment_routes import (
    router as replenishment_router,
)
from app.config import settings


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(product_router)
app.include_router(inventory_router)
app.include_router(order_router)
app.include_router(replenishment_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Furniture Inventory Management API is running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.app_env,
    }