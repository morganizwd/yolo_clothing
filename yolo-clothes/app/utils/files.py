"""
utils/files.py
"""
import uuid, shutil
from pathlib import Path
from fastapi import UploadFile

# <корень‑проекта>/app/static
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

def save_upload(username: str, uploaded: UploadFile, *, suffix=".jpg") -> str:
    """
    Сохраняет UploadFile в static/user/<username>/<uuid>.<ext>
    и возвращает относительный URL — например `/static/user/alice/abc.jpg`
    """
    # создаём папку, если её ещё нет
    folder = STATIC_DIR / "user" / username
    folder.mkdir(parents=True, exist_ok=True)

    # генерируем уникальное имя
    fname = f"{uuid.uuid4().hex}{suffix}"
    dest  = folder / fname

    # копируем поток
    with dest.open("wb") as out:
        shutil.copyfileobj(uploaded.file, out)

    return f"/static/user/{username}/{fname}"
