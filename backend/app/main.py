from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import admin, alerts, demo, events, health, incidents, logs, loop
from app.services import scheduler


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    from app.services import chaos

    chaos.reconcile_llm_flags()
    scheduler.start()
    try:
        yield
    finally:
        scheduler.stop()


app = FastAPI(
    title="IncidentBuddy API",
    description="On-call incident copilot with resilient agents (TrueFoundry hackathon)",
    version="0.2.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(health.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(demo.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(loop.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(events.router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "IncidentBuddy",
        "tagline": "Your on-call partner that doesn't quit when the tools do.",
        "docs": "/docs",
    }


@app.get("/healthz")
def healthz():
    """Lightweight liveness probe for Fly/Cloud Run/etc."""
    return {"status": "ok"}
