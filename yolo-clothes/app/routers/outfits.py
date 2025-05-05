# app/routers/outfits.py
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from ..schemas import OutfitRequest
from ..db     import outfits
from ..auth   import get_current_user

router = APIRouter(prefix="/outfits", tags=["outfits"])


@router.post("/", status_code=201)
async def save_outfit(req: OutfitRequest, user = Depends(get_current_user)):
    doc = req.dict()
    doc["user_id"] = user.username
    await outfits.insert_one(doc)
    return {"msg": "Outfit saved"}


@router.get("/", summary="Все луки пользователя")
async def list_outfits(user = Depends(get_current_user)):
    docs = await outfits.find({"user_id": user.username}).to_list(1_000)
    for d in docs:                        
        d["_id"] = str(d["_id"])
    return docs                          


@router.delete("/{oid}", status_code=204)
async def delete_outfit(oid: str, user = Depends(get_current_user)):
    if not ObjectId.is_valid(oid):
        raise HTTPException(400, "Bad id")

    res = await outfits.delete_one(
        {"_id": ObjectId(oid), "user_id": user.username}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
