# YOLO Clothing

> Web‑приложение для детекции и классификации предметов одежды на изображениях на основе модели **YOLOv5**. 
> Сервер реализован на **FastAPI**, клиент — на **React + TypeScript**.

---

## Стек технологий

| Слой          | Технологии                                                |
| ------------- | --------------------------------------------------------- |
| **Back‑end**  | Python 3.10, FastAPI, Uvicorn, Pydantic, YOLOv5 (PyTorch) |
| **Front‑end** | React Native, TypeScript, Vite¹, Bootstrap                |
| **Dev Ops**   | Docker (опционально), Git субмодули                       |

---

## Быстрый старт

```bash
# 1. Клонируем репозиторий вместе с сабмодулем yolov5
$ git clone --recursive https://github.com/morganizwd/yolo_clothing.git
$ cd yolo_clothing
```

### Запуск сервера

```bash
# Переходим в директорию сервера
$ cd yolo-clothes

# Создаём и активируем виртуальное окружение (реком.)
$ python -m venv .venv
$ source .venv/bin/activate           # Windows: .venv\Scripts\activate

# Устанавливаем зависимости
$ pip install --upgrade pip
$ pip install -r requirements.txt

# Поднимаем сервер с hot‑reload
$ uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Запуск клиента

```bash
# Из корня проекта:
$ cd client/my-app

# Устанавливаем npm‑зависимости (первый запуск)
$ npm install

# Стартуем expo react native
$ npm start 
```

Приложение откроется на **`http://localhost:3000`** (порт React по умолчанию).

---

## Структура репозитория

```
yolo_clothing/
├── client/
│   └── my-app/        # Front‑end (React + TS)
├── yolo-clothes/      # Back‑end (FastAPI)
│   ├── app/
│   │   ├── main.py
│   │   └── ...
│   ├── requirements.txt
│   └── ...
├── yolov5/            # Сабмодуль модели YOLOv5
└── README.md
```

---

## Переменные окружения (необязательно)

| Переменная             | Значение по умолчанию                            | Назначение                           |
| ---------------------- | ------------------------------------------------ | ------------------------------------ |
| `MODEL_WEIGHTS`        | `yolov5/runs/train/yolo_clothes/weights/best.pt` | Путь к весам модели                  |
| `CONF_THRESHOLD`       | `0.25`                                           | Порог уверенности детекции           |
| `CUDA_VISIBLE_DEVICES` | `0`                                              | Индекс GPU (`-1` — использовать CPU) |

Задайте их в файле `.env` в директории `yolo-clothes` или экспортируйте в терминале.

---

## REST API (основные эндпоинты)

| Метод  | URL              | Описание                                                                       |
| ------ | ---------------- | ------------------------------------------------------------------------------ |
| `GET`  | `/health`        | Проверка живости сервера                                                       |
| `POST` | `/predict/image` | Принимает изображение (form‑data `file`) и возвращает JSON со списком детекций |

Полное описание доступно в Swagger‑UI.

---

## Обучение / дообучение модели

Файлы датасета расположите в `yolo-clothes/data/`, отредактируйте `data.yaml`, затем запустите:

```bash
python yolov5/train.py \
  --img 640 \
  --batch 16 \
  --epochs 50 \
  --data data/data.yaml \
  --weights yolov5s.pt \
  --project runs/train/yolo_clothes
```

Сгенерированные веса положите в путь, указанный в `MODEL_WEIGHTS`.

---

