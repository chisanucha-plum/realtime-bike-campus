from fastapi import APIRouter

from app.routers.helmet import router as helmet_router
from app.routers.user import router as user_router


def get_router() -> APIRouter:
    router = APIRouter()
    router.include_router(helmet_router)
    router.include_router(user_router)
    return router

