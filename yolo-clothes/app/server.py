from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Tuple, Dict
import uvicorn, io, math, itertools, random, uuid

import torch, cv2, numpy as np
from PIL import Image

app = FastAPI(title="YOLO Clothing Detection API")

YOLO_REPO = "C:/Users/morga/yolov5"
WEIGHTS   = "C:/Users/morga/yolov5/runs/train/yolo_clothes3/weights/best.pt"
model     = torch.hub.load(YOLO_REPO, "custom", path=WEIGHTS, source="local")

# ---------- цвета и конвертации ---------------------------------------------------
popular_colors: Dict[str, Tuple[int, int, int]] = {  # 50 оттенков
    "белый": (255, 255, 255), "чёрный": (0, 0, 0), "красный": (255, 0, 0),
    "лаймовый": (0, 255, 0), "синий": (0, 0, 255), "жёлтый": (255, 255, 0),
    "циан": (0, 255, 255), "магента": (255, 0, 255), "серебряный": (192, 192, 192),
    "серый": (128, 128, 128), "бордовый": (128, 0, 0), "оливковый": (128, 128, 0),
    "зелёный": (0, 128, 0), "фиолетовый": (128, 0, 128), "бирюзовый": (0, 128, 128),
    "тёмно-синий": (0, 0, 128), "оранжевый": (255, 165, 0), "розовый": (255, 192, 203),
    "коричневый": (165, 42, 42), "золотой": (255, 215, 0), "бежевый": (245, 245, 220),
    "коралловый": (255, 127, 80), "слоновая кость": (255, 255, 240), "хаки": (240, 230, 140),
    "лавандовый": (230, 230, 250), "сливовый": (221, 160, 221), "орхидейный": (218, 112, 214),
    "лососевый": (250, 128, 114), "загорелый": (210, 180, 140), "фиалковый": (238, 130, 238),
    "бирюзовый светлый": (64, 224, 208), "индиго": (75, 0, 130), "шоколадный": (210, 105, 30),
    "багровый": (220, 20, 60), "лазурный": (240, 255, 255), "мятный": (189, 252, 201),
    "нежно-розовый": (255, 228, 225), "рубиновый": (224, 17, 95), "сапфировый": (15, 82, 186),
    "изумрудный": (80, 200, 120), "янтарный": (255, 191, 0), "бургундский": (128, 0, 32),
    "церулеевый": (42, 82, 190), "перивинкл": (204, 204, 255), "мув": (224, 176, 255),
    "горчичный": (255, 219, 88), "джинсовый": (21, 96, 189), "медный": (184, 115, 51),
    "бронзовый": (205, 127, 50), "оливково-серый": (107, 142, 35),
}
def rgb_to_lab(rgb): return cv2.cvtColor(np.uint8([[list(rgb)]]), cv2.COLOR_RGB2LAB)[0][0]
popular_lab = {n: rgb_to_lab(c) for n, c in popular_colors.items()}
def match_color(rgb):
    lab = rgb_to_lab(rgb)
    if math.hypot(float(lab[1]), float(lab[2])) < 10: return "серый"
    return min(popular_lab, key=lambda n: np.linalg.norm(lab - popular_lab[n]))

# ---------- модели данных ---------------------------------------------------------
class DetectionItem(BaseModel):
    image_id: str
    index: int
    name: str
    confidence: float
    bbox: Tuple[int, int, int, int]
    dominant_color: Tuple[int, int, int]
    color_name: str
class RecommendRequest(BaseModel):
    detections: List[DetectionItem]
class RecommendResponse(BaseModel):
    method: str
    score: float
    items: List[DetectionItem]

# ---------- детекция --------------------------------------------------------------
@app.post("/detect", response_model=List[DetectionItem])
async def detect(file: UploadFile = File(...)):
    img = Image.open(io.BytesIO(await file.read())).convert("RGB")
    df  = model(np.array(img)).pandas().xyxy[0]

    items: List[DetectionItem] = []
    unique_id = f"{file.filename}_{uuid.uuid4().hex[:8]}"         # <— УНИКАЛЬНО!

    for idx, row in df.iterrows():
        x0, y0, x1, y1 = map(int, (row.xmin, row.ymin, row.xmax, row.ymax))
        crop  = np.array(img)[y0:y1, x0:x1]
        lab   = cv2.cvtColor(crop, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
        _, lab_lbl, lab_ctr = cv2.kmeans(lab, 3, None,
                                         (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,10,1.0),
                                         10, cv2.KMEANS_RANDOM_CENTERS)
        dom_lab = lab_ctr[np.argmax(np.bincount(lab_lbl.flatten()))]
        dom_rgb = tuple(int(x) for x in cv2.cvtColor(np.uint8([[dom_lab]]), cv2.COLOR_LAB2RGB)[0][0])

        items.append(DetectionItem(
            image_id=unique_id,
            index=int(idx),
            name=row['name'],
            confidence=float(row['confidence']),
            bbox=(x0, y0, x1, y1),
            dominant_color=dom_rgb,
            color_name=match_color(dom_rgb)
        ))
    return items

# ---------- hue-утилиты и счётчики -------------------------------------------------
def get_hue(rgb):
    lab = rgb_to_lab(rgb); h = math.degrees(math.atan2(float(lab[2]), float(lab[1])))
    return h + 360 if h < 0 else h
def score_similar(c):      # низко = близко
    hs=[get_hue(i.dominant_color) for i in c if i.color_name not in ('серый','чёрный','белый')]
    return 0 if len(hs)<2 else sum(min(abs(a-b),360-abs(a-b)) for a in hs for b in hs if a!=b)/(len(hs)*(len(hs)-1))
def score_contrast(c):     return -score_similar(c)
def score_monochrome(c):
    hs=[get_hue(i.dominant_color) for i in c if i.color_name not in ('серый','чёрный','белый')]
    if not hs: return 0
    avg=sum(hs)/len(hs)
    return sum((h-avg)**2 for h in hs)/len(hs)
def score_complementary(c):
    hs=[get_hue(i.dominant_color) for i in c if i.color_name not in ('серый','чёрный','белый')]
    if len(hs)<2: return float('inf')
    return sum(abs(min(abs(a-b),360-abs(a-b))-180) for a in hs for b in hs if a!=b)/(len(hs)*(len(hs)-1))
def score_random(c): return random.random()

# ---------- рекомендация ----------------------------------------------------------
@app.post("/recommend", response_model=List[RecommendResponse])
async def recommend(req: RecommendRequest):
    by_cat={}
    for it in req.detections:
        by_cat.setdefault(it.name, []).append(it)

    combos = list(itertools.product(*(by_cat[c] for c in by_cat)))
    def key(it): return (it.image_id, it.index)
    unique = [c for c in combos if len({key(i) for i in c}) == len(c)]
    if not unique:
        return [RecommendResponse(method='Нет уникальных сочетаний', score=0, items=[])]

    methods = {
        "Похожие цвета": score_similar, "Контрастные": score_contrast,
        "Монохромный":   score_monochrome, "Комплементарные": score_complementary,
        "Случайный":     score_random
    }
    used=set(); out=[]
    for m,fn in methods.items():
        best=best_score=None
        for combo in sorted(unique, key=fn):
            ids={key(i) for i in combo}
            if ids.isdisjoint(used):
                best_score=fn(combo); best=list(combo); used|=ids; break
        out.append(RecommendResponse(method=m, score=best_score or 0.0, items=best or []))
    print('recommend ->', [(o.method,len(o.items)) for o in out])   # debug
    return out

# -------------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
