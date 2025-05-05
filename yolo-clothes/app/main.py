# main.py
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles  

from .routers import auth, photos, outfits, detect, recommend
from .health  import router as health_router

BASE_DIR   = Path(__file__).resolve().parent     
STATIC_DIR = BASE_DIR / "static"               

app = FastAPI(title="YOLO Clothing Detection API")

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR, html=False),
    name="static",
)

app.include_router(health_router)

app.include_router(auth.router)
app.include_router(photos.router)
app.include_router(outfits.router)
app.include_router(detect.router)
app.include_router(recommend.router)