# app/schemas.py
from pydantic import BaseModel
from typing import List
from datetime import datetime
from .models import DetectionItem

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class PhotoRequest(BaseModel):
    uri: str

class OutfitRequest(BaseModel):
    name: str
    date: datetime
    items: List[DetectionItem]
    photo_uris: List[str]
