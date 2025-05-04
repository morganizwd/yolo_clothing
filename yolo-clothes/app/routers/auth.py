# app/routers/auth.py
from fastapi import APIRouter, HTTPException, status, Depends
from ..db import users
from ..utils import hash_password, verify_password, create_access_token
from ..schemas import RegisterRequest, LoginRequest, Token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    if await users.find_one({"username": req.username}):
        raise HTTPException(400, "User already exists")
    hashed = hash_password(req.password)
    await users.insert_one({"username": req.username, "hashed_password": hashed})
    return {"msg": "Registered"}

@router.post("/login", response_model=Token)
async def login(req: LoginRequest):
    user = await users.find_one({"username": req.username})
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = create_access_token({"sub": req.username})
    return {"access_token": token}
