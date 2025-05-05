"""
utils/files.py
"""
import uuid, shutil
from pathlib import Path
from fastapi import UploadFile

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

def save_upload(username: str, uploaded: UploadFile, *, suffix=".jpg") -> str:

    folder = STATIC_DIR / "user" / username
    folder.mkdir(parents=True, exist_ok=True)

    fname = f"{uuid.uuid4().hex}{suffix}"
    dest  = folder / fname

    with dest.open("wb") as out:
        shutil.copyfileobj(uploaded.file, out)

    return f"/static/user/{username}/{fname}"