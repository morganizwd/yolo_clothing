# app/config.py
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str = os.getenv(
        "MONGO_URI",
        "mongodb://admin:He12345678@ac-hz3edyi-shard-00-00.vgtv5yo.mongodb.net:27017,ac-hz3edyi-shard-00-01.vgtv5yo.mongodb.net:27017,ac-hz3edyi-shard-00-02.vgtv5yo.mongodb.net:27017/yoloclothes?ssl=true&replicaSet=atlas-124m2q-shard-0&authSource=admin&retryWrites=true&w=majority"
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change_this_secret")
    JWT_ALGORITHM: str = "HS256"                     # <-- здесь был пропущен тип
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

settings = Settings()
