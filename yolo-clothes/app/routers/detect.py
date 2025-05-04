#touters/detect.py
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, status
from typing import List, Tuple, Dict
import io, uuid, math
from PIL import Image
import numpy as np
import cv2, torch

from ..auth   import get_current_user
from ..models import DetectionItem
from ..db     import photos
from ..utils import save_upload      

# ───────────────────────── YOLOv5 ──────────────────────────
YOLO_REPO = r"C:/Users/morga/yolov5"
WEIGHTS   = r"C:/Users/morga/yolov5/runs/train/yolo_clothes3/weights/best.pt"
model     = torch.hub.load(YOLO_REPO, "custom", path=WEIGHTS, source="local")

# ───────────────────────── цвета ───────────────────────────
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
def rgb_to_lab(rgb):                                       # RGB→LAB
    return cv2.cvtColor(np.uint8([[list(rgb)]]), cv2.COLOR_RGB2LAB)[0][0]

_popular_lab = {n: rgb_to_lab(c) for n, c in popular_colors.items()}

def match_color(rgb):
    lab = rgb_to_lab(rgb)
    if np.hypot(float(lab[1]), float(lab[2])) < 10:        # почти серое
        return "серый"
    return min(_popular_lab, key=lambda n: np.linalg.norm(lab - _popular_lab[n]))

# ───────────────────────── Router ──────────────────────────
router = APIRouter(prefix="/detect", tags=["detect"])

@router.post(
    "/", response_model=List[DetectionItem],
    summary="Детектировать одежду и сохранить снимок"
)
async def detect_clothes(
    file: UploadFile = File(...),
    user = Depends(get_current_user)
):
    """
    ‑ Сохраняет оригинал снимка в *static/user/<login>*.  
    ‑ Запускает YOLOv5, вычисляет доминантный цвет.  
    ‑ Сохраняет документ в MongoDB → коллекция **photos**.  
    ‑ Возвращает список *DetectionItem* – сразу можно рисовать на клиенте.
    """

   
    uri_orig = save_upload(user.username, file)            # '/static/user/…/abc.jpg'

   
    file.file.seek(0)                                      # вернуть курсор к началу
    data = file.file.read()
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as ex:
        raise HTTPException(400, "Невозможно прочитать изображение") from ex

    np_img = np.array(img)
    df     = model(np_img).pandas().xyxy[0]

   
    dets: list[DetectionItem] = []
    unique_id = f"{file.filename}_{uuid.uuid4().hex[:8]}"

    for idx, row in df.iterrows():
        x0, y0, x1, y1 = map(int, (row.xmin, row.ymin, row.xmax, row.ymax))
        crop = np_img[y0:y1, x0:x1]

        # k‑means в LAB для доминантного цвета
        lab_pixels = cv2.cvtColor(crop, cv2.COLOR_RGB2LAB)\
                        .reshape(-1, 3).astype(np.float32)
        _, lbl, ctr = cv2.kmeans(
            lab_pixels, 3, None,
            (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0),
            10, cv2.KMEANS_RANDOM_CENTERS
        )
        dom_lab = ctr[np.argmax(np.bincount(lbl.flatten()))]
        dom_rgb = tuple(int(v) for v in cv2.cvtColor(
            np.uint8([[dom_lab]]), cv2.COLOR_LAB2RGB
        )[0][0])

        dets.append(DetectionItem(
            image_id       = unique_id,
            index          = int(idx),
            name           = row["name"],
            confidence     = float(row["confidence"]),
            bbox           = (x0, y0, x1, y1),
            dominant_color = dom_rgb,
            color_name     = match_color(dom_rgb)
        ))

    
    await photos.insert_one({
        "user_id":     user.username,
        "uri_orig":    uri_orig,
        "detections":  [d.model_dump() for d in dets],
    })

    return dets
