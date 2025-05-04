# app/health.py
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

router = APIRouter(tags=["health"])

client = AsyncIOMotorClient(settings.MONGO_URI)

@router.get("/health/db")
async def ping_db():
    try:
        await client.admin.command("ping")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
