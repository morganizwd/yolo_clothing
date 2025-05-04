# app/routers/photos.py
from fastapi import APIRouter, Depends, HTTPException
from ..schemas import PhotoRequest
from ..db import photos
from ..auth import get_current_user

router = APIRouter(prefix="/photos", tags=["photos"])

@router.post("/", status_code=201)
async def add_photo(req: PhotoRequest, user=Depends(get_current_user)):
    """Сохранить URI загруженной пользователем фотографии"""
    await photos.insert_one({"user_id": user.username, "uri": req.uri})
    return {"msg": "Saved"}

@router.get("/", response_model=list[str])
async def list_photos(user=Depends(get_current_user)):
    cursor = photos.find({"user_id": user.username})
    return [doc["uri"] for doc in await cursor.to_list(length=1000)]
