from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Tuple, Dict, Optional, Any
import uvicorn
import io
from PIL import Image
import torch
import cv2
import numpy as np
import math
import itertools
import random

app = FastAPI(title="YOLO Clothing Detection API")

# Загрузка модели при старте
YOLO_REPO = "C:/Users/morga/yolov5"
WEIGHTS_PATH = "C:/Users/morga/yolov5/runs/train/yolo_clothes3/weights/best.pt"
model = torch.hub.load(YOLO_REPO, 'custom', path=WEIGHTS_PATH, source='local')

# 50 популярных цветов
popular_colors: Dict[str, Tuple[int, int, int]] = {
    "белый": (255, 255, 255),
    "чёрный": (0, 0, 0),
    "красный": (255, 0, 0),
    "лаймовый": (0, 255, 0),
    "синий": (0, 0, 255),
    "жёлтый": (255, 255, 0),
    "циан": (0, 255, 255),
    "магента": (255, 0, 255),
    "серебряный": (192, 192, 192),
    "серый": (128, 128, 128),
    "бордовый": (128, 0, 0),
    "оливковый": (128, 128, 0),
    "зелёный": (0, 128, 0),
    "фиолетовый": (128, 0, 128),
    "бирюзовый": (0, 128, 128),
    "тёмно-синий": (0, 0, 128),
    "оранжевый": (255, 165, 0),
    "розовый": (255, 192, 203),
    "коричневый": (165, 42, 42),
    "золотой": (255, 215, 0),
    "бежевый": (245, 245, 220),
    "коралловый": (255, 127, 80),
    "слоновая кость": (255, 255, 240),
    "хаки": (240, 230, 140),
    "лавандовый": (230, 230, 250),
    "сливовый": (221, 160, 221),
    "орхидейный": (218, 112, 214),
    "лососевый": (250, 128, 114),
    "загорелый": (210, 180, 140),
    "фиалковый": (238, 130, 238),
    "бирюзовый светлый": (64, 224, 208),
    "индиго": (75, 0, 130),
    "шоколадный": (210, 105, 30),
    "багровый": (220, 20, 60),
    "лазурный": (240, 255, 255),
    "мятный": (189, 252, 201),
    "нежно-розовый": (255, 228, 225),
    "рубиновый": (224, 17, 95),
    "сапфировый": (15, 82, 186),
    "изумрудный": (80, 200, 120),
    "янтарный": (255, 191, 0),
    "бургундский": (128, 0, 32),
    "церулеевый": (42, 82, 190),
    "перивинкл": (204, 204, 255),
    "мув": (224, 176, 255),
    "горчичный": (255, 219, 88),
    "джинсовый": (21, 96, 189),
    "медный": (184, 115, 51),
    "бронзовый": (205, 127, 50),
    "оливково-серый": (107, 142, 35)
}

# Преобработка цвета

def rgb_to_lab(rgb: Tuple[int,int,int]) -> np.ndarray:
    arr = np.uint8([[list(rgb)]])
    return cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)[0][0]

def lab_distance(l1: np.ndarray, l2: np.ndarray) -> float:
    return float(np.linalg.norm(l1.astype(float) - l2.astype(float)))

# Предварительный расчёт
popular_lab = {name: rgb_to_lab(rgb) for name, rgb in popular_colors.items()}

def match_color_lab(rgb: Tuple[int,int,int]) -> str:
    lab = rgb_to_lab(rgb)
    chroma = math.hypot(float(lab[1]), float(lab[2]))
    if chroma < 10:
        return "серый"
    best = min(popular_lab.items(), key=lambda kv: lab_distance(lab, kv[1]))
    return best[0]

# Pydantic-модели
class DetectionItem(BaseModel):
    image_id: str
    index: int
    name: str
    confidence: float
    bbox: Tuple[int,int,int,int]
    dominant_color: Tuple[int,int,int]
    color_name: str

class RecommendRequest(BaseModel):
    detections: List[DetectionItem]

class RecommendResponse(BaseModel):
    method: str
    score: float
    items: List[DetectionItem]

class ReplaceRequest(BaseModel):
    detections: List[DetectionItem]
    method: str
    outfit: List[int]  # list of detection indexes
    element_index: int

class AlternativesResponse(BaseModel):
    alternatives: List[DetectionItem]

class GenerateRequest(BaseModel):
    detections: List[DetectionItem]
    base_index: int

class CombosResponse(BaseModel):
    combos: List[List[DetectionItem]]

class EditRequest(BaseModel):
    detections: List[DetectionItem]
    edits: Dict[int, Dict[str, Any]]  # index -> {"name":..., "color_name":...}

# Core detection endpoint
@app.post("/detect", response_model=List[DetectionItem])
async def detect(file: UploadFile = File(...)):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert('RGB')
    arr = np.array(img)
    results = model(arr)
    df = results.pandas().xyxy[0]
    items: List[DetectionItem] = []
    for idx, row in df.iterrows():
        x0,y0,x1,y1 = map(int,(row.xmin,row.ymin,row.xmax,row.ymax))
        crop = img.crop((x0,y0,x1,y1))
        lab_crop = cv2.cvtColor(np.array(crop), cv2.COLOR_RGB2LAB)
        pixels = lab_crop.reshape(-1,3).astype(np.float32)
        _, labels, centers = cv2.kmeans(pixels, 3, None,
                                        (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,10,1.0),
                                        10, cv2.KMEANS_RANDOM_CENTERS)
        dom_lab = centers[np.argmax(np.bincount(labels.flatten()))]
        dom_rgb = cv2.cvtColor(np.uint8([[dom_lab]]), cv2.COLOR_LAB2RGB)[0][0]
        dom = (int(dom_rgb[0]), int(dom_rgb[1]), int(dom_rgb[2]))
        items.append(DetectionItem(
            image_id=file.filename,
            index=int(idx),
            name=row['name'],
            confidence=float(row['confidence']),
            bbox=(x0,y0,x1,y1),
            dominant_color=dom,
            color_name=match_color_lab(dom)
        ))
    return items

# Annotate with overrides
@app.post("/annotate", response_class=StreamingResponse)
async def annotate(file: UploadFile = File(...), edits: Optional[EditRequest] = None):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert('RGB')
    arr = np.array(img)
    results = model(arr)
    df = results.pandas().xyxy[0]
    if edits:
        # Apply class/color edits
        for edit_idx, params in edits.edits.items():
            df.at[edit_idx, 'name'] = params.get('name', df.at[edit_idx, 'name'])
    # Draw
    for idx, row in df.iterrows():
        x0,y0,x1,y1 = map(int,(row.xmin,row.ymin,row.xmax,row.ymax))
        cv2.rectangle(arr,(x0,y0),(x1,y1),(0,255,0),2)
        label = f"{row['name']}"
        cv2.putText(arr, label, (x0, max(y0-10,0)), cv2.FONT_HERSHEY_SIMPLEX,0.5,(0,255,0),2)
    _, buf = cv2.imencode('.jpg', cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
    return StreamingResponse(io.BytesIO(buf.tobytes()), media_type="image/jpeg")

# Recommendation logic

def score_similar(combo):
    hues = [get_hue(c.dominant_color) for c in combo if c.color_name not in ['серый','чёрный','белый']]
    if len(hues)<2: return 0.0
    dists = [min(abs(hues[i]-hues[j]),360-abs(hues[i]-hues[j]))
             for i in range(len(hues)) for j in range(i+1,len(hues))]
    return sum(dists)/len(dists)

def score_contrast(combo): return -score_similar(combo)

def score_monochrome(combo):
    hues = [get_hue(c.dominant_color) for c in combo if c.color_name not in ['серый','чёрный','белый']]
    if not hues: return 0.0
    avg=sum(hues)/len(hues)
    return sum((h-avg)**2 for h in hues)/len(hues)

def score_complementary(combo):
    hues=[get_hue(c.dominant_color) for c in combo if c.color_name not in ['серый','чёрный','белый']]
    if len(hues)<2: return float('inf')
    vals=[abs(min(abs(hues[i]-hues[j]),360-abs(hues[i]-hues[j]))-180)
          for i in range(len(hues)) for j in range(i+1,len(hues))]
    return sum(vals)/len(vals)

def score_random(combo): return random.random()

def get_hue(rgb):
    lab=rgb_to_lab(rgb)
    a,b=lab[1],lab[2]
    h=math.degrees(math.atan2(float(b),float(a)))
    return h+360 if h<0 else h

@app.post("/recommend", response_model=List[RecommendResponse])
async def recommend(req: RecommendRequest):
    items=req.detections
    by_cat={}
    for it in items:
        by_cat.setdefault(it.name,[]).append(it)
    cats=list(by_cat)
    combos=list(itertools.product(*(by_cat[c] for c in cats)))
    unique=[c for c in combos if len({i.image_id for i in c})==len(c)]
    methods={"Похожие цвета":score_similar,
             "Контрастные":score_contrast,
             "Монохромный":score_monochrome,
             "Комплементарные":score_complementary,
             "Случайный":score_random}
    used=set();out=[]
    for m,fn in methods.items():
        best=None;best_score=None
        for combo in sorted(unique,key=fn):
            ids={i.index for i in combo}
            if not ids & used:
                best_score=fn(combo);best=list(combo);used |= ids;break
        out.append(RecommendResponse(method=m,score=best_score or 0.0,items=best or []))
    return out

@app.post("/recommend/alternatives", response_model=AlternativesResponse)
async def alternatives(req: ReplaceRequest):
    items=req.detections
    # build category group
    target=req.outfit[req.element_index]
    cat=[i for i in items if i.index==target][0].name
    alts=[i for i in items if i.name==cat and i.index not in req.outfit]
    return AlternativesResponse(alternatives=alts)

@app.post("/generate", response_model=CombosResponse)
async def generate(req: GenerateRequest):
    items=req.detections
    base=[i for i in items if i.index==req.base_index][0]
    by_cat={base.name:[base]}
    for it in items:
        if it.name!=base.name:
            by_cat.setdefault(it.name,[]).append(it)
    cats=list(by_cat)
    combos=[list(c) for c in itertools.product(*(by_cat[c] for c in cats))]
    return CombosResponse(combos=combos)

@app.post("/edit", response_model=List[DetectionItem])
async def edit(req: EditRequest):
    items=req.detections
    for idx,ed in req.edits.items():
        for it in items:
            if it.index==idx:
                it.name=ed.get('name',it.name)
                it.color_name=ed.get('color_name',it.color_name)
    return items

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
