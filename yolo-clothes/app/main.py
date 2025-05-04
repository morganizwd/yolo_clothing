# app/main.py
from fastapi import FastAPI
from .routers import auth, photos, outfits, detect, recommend
from .health import router as health_router

app = FastAPI(title="YOLO Clothing Detection API")

app.include_router(health_router)

app.include_router(auth.router)
app.include_router(photos.router)
app.include_router(outfits.router)
app.include_router(detect.router)
app.include_router(recommend.router)
