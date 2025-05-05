# app/routers/recommend.py

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import itertools, math, random
from ..models import DetectionItem, RecommendRequest, RecommendResponse
from ..auth import get_current_user

router = APIRouter(prefix="/recommend", tags=["recommend"])

def rgb_to_lab(rgb):
    import cv2, numpy as np
    return cv2.cvtColor(np.uint8([[list(rgb)]]), cv2.COLOR_RGB2LAB)[0][0]

def get_hue(rgb):
    lab = rgb_to_lab(rgb)
    h = math.degrees(math.atan2(float(lab[2]), float(lab[1])))
    return h+360 if h<0 else h

def score_similar(combo):
    hs = [get_hue(i.dominant_color) for i in combo if i.color_name not in ('серый','чёрный','белый')]
    if len(hs) < 2: return 0
    return sum(min(abs(a-b),360-abs(a-b)) for a in hs for b in hs if a!=b) / (len(hs)*(len(hs)-1))

def score_contrast(combo):      return -score_similar(combo)
def score_monochrome(combo):
    hs = [get_hue(i.dominant_color) for i in combo if i.color_name not in ('серый','чёрный','белый')]
    if not hs: return 0
    avg = sum(hs)/len(hs)
    return sum((h-avg)**2 for h in hs)/len(hs)

def score_complementary(combo):
    hs = [get_hue(i.dominant_color) for i in combo if i.color_name not in ('серый','чёрный','белый')]
    if len(hs) < 2: return float('inf')
    return sum(abs(min(abs(a-b),360-abs(a-b)) - 180) for a in hs for b in hs if a!=b) / (len(hs)*(len(hs)-1))

def score_random(combo): return random.random()

@router.post(
    "/",
    response_model=List[RecommendResponse],
    status_code=status.HTTP_200_OK,
    summary="Сгенерировать рекомендованные комплекты"
)
async def recommend_outfits(
    req: RecommendRequest,
    user = Depends(get_current_user)     
):
    by_cat: dict[str, list[DetectionItem]] = {}
    for det in req.detections:
        by_cat.setdefault(det.name, []).append(det)

    combos = list(itertools.product(*by_cat.values()))
  
    def key(i: DetectionItem): return (i.image_id, i.index)
    unique = [c for c in combos if len({key(i) for i in c}) == len(c)]
    if not unique:
        raise HTTPException(status_code=400, detail="Нет уникальных сочетаний")

    methods = {
        "Похожие цвета": score_similar,
        "Контрастные": score_contrast,
        "Монохромный": score_monochrome,
        "Комплементарные": score_complementary,
        "Случайный": score_random,
    }

    used = set()
    output: List[RecommendResponse] = []

    for name, func in methods.items():
        best_combo = None
        best_score = None
        for combo in sorted(unique, key=func):
            ids = {key(i) for i in combo}
            if ids.isdisjoint(used):
                best_combo = list(combo)
                best_score = func(combo)
                used |= ids
                break
        output.append(RecommendResponse(
            method=name,
            score=best_score or 0.0,
            items=best_combo or []
        ))

    return output
