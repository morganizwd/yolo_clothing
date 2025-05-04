# app/models.py
from pydantic import BaseModel, Field
from typing import List, Tuple
from datetime import datetime

class DetectionItem(BaseModel):
    image_id: str
    index: int
    name: str
    confidence: float
    bbox: Tuple[int,int,int,int]
    dominant_color: Tuple[int,int,int]
    color_name: str

class RecommendRequest(BaseModel):
    detections: List[DetectionItem]

class RecommendResponse(BaseModel):
    method: str
    score: float
    items: List[DetectionItem]

class UserIn(BaseModel):
    """Что приходит от клиента при регистрации / логине"""
    username: str
    password: str          # <-- открытый пароль (только во входящих запросах)

class UserInDB(BaseModel):
    """То, что мы реально храним в БД и передаём из get_current_user"""
    username: str
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class Photo(BaseModel):
    user_id: str
    uri: str

class OutfitIn(BaseModel):
    name: str                  # «Деловой вторник»
    date: datetime             # 2024‑06‑15
    items: list[DetectionItem] # полный список из recommend
    photo_uris: list[str]      # для превью (можно [] ← необязательно)

class Outfit(OutfitIn):
    """Документ, который лежит в MongoDB"""
    _id: str                   # ObjectId → str (заполняем в router)
    user_id: str               # чей комплект
