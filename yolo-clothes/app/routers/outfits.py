# app/routers/outfits.py
from fastapi import APIRouter, Depends, HTTPException
from ..schemas import OutfitRequest
from ..models import Outfit
from ..db import outfits
from ..auth import get_current_user

router = APIRouter(prefix="/outfits", tags=["outfits"])

@router.post("/", status_code=201)
async def save_outfit(req: OutfitRequest, user=Depends(get_current_user)):
    doc = req.dict()
    doc["user_id"] = user.username
    await outfits.insert_one(doc)
    return {"msg": "Outfit saved"}

@router.get("/", response_model=list[Outfit])
async def list_outfits(user=Depends(get_current_user)):
    cursor = outfits.find({"user_id": user.username})
    return await cursor.to_list(length=1000)
