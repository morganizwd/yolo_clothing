# app/db.py
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client = AsyncIOMotorClient(settings.MONGO_URI)
db = client.get_default_database()
users = db["users"]
photos = db["photos"]
outfits = db["outfits"]
