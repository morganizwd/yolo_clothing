# app/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer      
from jose import JWTError, jwt

from .db import users
from .config import settings
from .models import UserInDB

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login") 

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_doc = await users.find_one({"username": username})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")

    return UserInDB(
        username=user_doc["username"],
        hashed_password=user_doc["hashed_password"],
    )