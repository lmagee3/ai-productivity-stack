from fastapi import APIRouter
from app.core.database import check_connection

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    db_connected = check_connection()
    return {
        "status": "ok" if db_connected else "error",
        "db": "connected" if db_connected else "disconnected",
    }
