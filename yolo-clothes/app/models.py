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
    password: str         

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
    name: str                 
    date: datetime           
    items: list[DetectionItem] 
    photo_uris: list[str]      

class Outfit(OutfitIn):
    """Документ, который лежит в MongoDB"""
    _id: str                
    user_id: str              
