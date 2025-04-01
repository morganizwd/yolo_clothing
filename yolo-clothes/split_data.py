import os
import random
import shutil

# Названия папок
SOURCE_DIR = "photos+txt"     # здесь все .jpg, .png и .txt
DEST_DIR = "dataset"          # сюда всё разложим
VAL_RATIO = 0.2               # 20% — на валидацию

# Создание папок для train и val
for split in ['train', 'val']:
    os.makedirs(os.path.join(DEST_DIR, 'images', split), exist_ok=True)
    os.makedirs(os.path.join(DEST_DIR, 'labels', split), exist_ok=True)

# Список всех изображений (jpg и png)
images = [f for f in os.listdir(SOURCE_DIR) if f.lower().endswith(('.jpg', '.png'))]
random.shuffle(images)

# Разделение данных
val_count = int(len(images) * VAL_RATIO)
val_images = images[:val_count]
train_images = images[val_count:]

def copy_files(image_list, split):
    for img_file in image_list:
        # Получаем базовое имя файла (без расширения)
        base = os.path.splitext(img_file)[0]
        label_file = base + '.txt'
        src_img = os.path.join(SOURCE_DIR, img_file)
        src_lbl = os.path.join(SOURCE_DIR, label_file)

        dst_img = os.path.join(DEST_DIR, 'images', split, img_file)
        dst_lbl = os.path.join(DEST_DIR, 'labels', split, label_file)

        if os.path.exists(src_lbl):
            shutil.copy(src_img, dst_img)
            shutil.copy(src_lbl, dst_lbl)
        else:
            print(f"⚠️ Нет разметки для: {img_file}, пропущено")

copy_files(train_images, 'train')
copy_files(val_images, 'val')

print("✅ Данные успешно разделены и скопированы.")
