# routers/photos.py
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from pathlib import Path
from urllib.parse import unquote
from typing import List
from ..models import DetectionItem

from ..db     import photos
from ..auth   import get_current_user
from ..config import STATIC_DIR                # <‑ ../static

router = APIRouter(prefix="/photos", tags=["photos"])

@router.get("/")
async def list_photos(user = Depends(get_current_user)):
    docs = await photos.find({"user_id": user.username}).to_list(1000)
    for d in docs:           # ObjectId‑>str (удобно клиенту)
        d["_id"] = str(d["_id"])
    return docs


@router.delete("/{photo_id}", status_code=204)
async def remove_photo(photo_id: str, user = Depends(get_current_user)):
    doc = await photos.find_one(
        {"_id": ObjectId(photo_id), "user_id": user.username}
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    # uri_orig →  static/user/<login>/abc.jpg
    rel = Path(unquote(doc["uri_orig"].lstrip("/")))          # Path('static/user/…')
    try:
        rel_in_static = rel.relative_to("static")             # user/<login>/abc.jpg
    except ValueError:
        rel_in_static = rel                                   

    abs_path = (STATIC_DIR / rel_in_static).resolve()         # …/static/user/…/abc.jpg
    if abs_path.is_file():
        abs_path.unlink(missing_ok=True)

    await photos.delete_one({"_id": ObjectId(photo_id)})

@router.patch(
    "/{photo_id}",
    summary="Обновить список детекций для фото",
    status_code=204,
)
async def update_detections(
    photo_id: str,
    detections: List[DetectionItem],
    user = Depends(get_current_user),
):
    """
    Заменяет поле `detections` в документе photo_id на новый массив.
    """
    obj_id = ObjectId(photo_id)
    # проверим, что документ принадлежит пользователю
    res = await photos.update_one(
        {"_id": obj_id, "user_id": user.username},
        {"$set": {"detections": [d.model_dump() for d in detections]}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return