from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from app.api.routes.brain import router as brain_router
from app.api.routes.health import router as health_router
from app.api.routes.status import router as status_router
from app.api.routes.ingest_blackboard import router as ingest_blackboard_router
from app.api.routes.ingest_assignment import router as ingest_assignment_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.ops import router as ops_router
from app.api.routes.ops_next import router as ops_next_router
from app.api.routes.chat import router as chat_router
from app.api.routes.brain_chat import router as brain_chat_router
from app.api.routes.brain_registry import router as brain_registry_router
from app.api.routes.files_scan import router as files_scan_router
from app.api.routes.news import router as news_router
from app.api.routes.ingest_connectors import router as ingest_connectors_router
from app.api.routes.runtime import router as runtime_router
from app.api.routes.notion import router as notion_router
from app.api.routes.market_weather import router as market_weather_router
from app.api.routes.web_search import router as web_search_router
from app.core.security import require_api_key
from app.core.automation_runtime import start_runtime, stop_runtime
from app.core.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="module_09 API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    deps = [Depends(require_api_key)]
    app.include_router(health_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(status_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(brain_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(ingest_blackboard_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(ingest_assignment_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(alerts_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(ops_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(ops_next_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(chat_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(brain_chat_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(brain_registry_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(files_scan_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(news_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(ingest_connectors_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(runtime_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(notion_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(market_weather_router, prefix=settings.API_PREFIX, dependencies=deps)
    app.include_router(web_search_router, prefix=settings.API_PREFIX, dependencies=deps)

    @app.on_event("startup")
    def _startup_runtime() -> None:
        # TEMPORARY: Disabled auto-runtime due to startup hang
        # TODO: Debug news/email/scan blocking on startup
        pass
        # start_runtime()

    @app.on_event("shutdown")
    def _shutdown_runtime() -> None:
        stop_runtime()

    return app


app = create_app()
