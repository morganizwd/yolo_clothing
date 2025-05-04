#routers/photos.py
from fastapi import APIRouter, Depends
from bson import ObjectId

from ..db     import photos
from ..auth   import get_current_user

router = APIRouter(prefix="/photos", tags=["photos"])

@router.get("/", summary="Вернуть все фото пользователя")
async def list_photos(user = Depends(get_current_user)):
    """
    Отдаёт массив документов:
    ```json
    [
      {
        "_id":  "663d…",
        "uri_orig": "/static/user/alice/abc.jpg",
        "detections": [ {...}, ... ]
      },
      ...
    ]
    ```
    """
    docs = await photos.find({"user_id": user.username}).to_list(1_000)
    for d in docs:
        d["_id"] = str(d["_id"])           # ObjectId → str, чтоб клиент не падал
    return docs
