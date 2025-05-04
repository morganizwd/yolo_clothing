import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk
import torch
import cv2
import io
import math
import itertools
import random
import numpy as np
import pandas as pd

# 50 популярных цветов (ключи – названия на русском)
popular_colors = {
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

# Функция для создания скроллируемого фрейма
def create_scrollable_frame(parent, width=500, height=400):
    canvas = tk.Canvas(parent, width=width, height=height)
    scrollbar = tk.Scrollbar(parent, orient="vertical", command=canvas.yview)
    scrollable_frame = tk.Frame(canvas)
    scrollable_frame.bind(
        "<Configure>",
        lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )
    canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar.set)
    canvas.pack(side="left", fill="both", expand=True)
    scrollbar.pack(side="right", fill="y")
    return scrollable_frame

# Преобразование RGB -> LAB
def rgb_to_lab(rgb):
    rgb_np = np.uint8([[list(rgb)]])
    lab = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2LAB)
    return lab[0][0]

# Преобразование LAB -> LCH (с приведением к float для избежания переполнения)
def lab_to_lch(lab):
    L, a, b = lab
    C = math.sqrt(float(a)*float(a) + float(b)*float(b))
    h_rad = math.atan2(float(b), float(a))
    h_deg = math.degrees(h_rad)
    if h_deg < 0:
        h_deg += 360
    return (L, C, h_deg)

def get_hue_from_rgb(rgb):
    lab = rgb_to_lab(rgb)
    L, C, h = lab_to_lch(lab)
    return h

# Предварительный расчёт LAB для популярных цветов
popular_colors_lab = {}
for color_name, rgb in popular_colors.items():
    popular_colors_lab[color_name] = rgb_to_lab(rgb)

def lab_distance(lab1, lab2):
    return math.sqrt(sum((float(a)-float(b))**2 for a, b in zip(lab1, lab2)))

def match_color_lab(dominant_color):
    dominant_lab = rgb_to_lab(dominant_color)
    chroma = math.sqrt(float(dominant_lab[1])**2 + float(dominant_lab[2])**2)
    if chroma < 10:
        return "серый"
    best_match = None
    min_distance = float('inf')
    for color_name, lab in popular_colors_lab.items():
        distance = lab_distance(dominant_lab, lab)
        if distance < min_distance:
            min_distance = distance
            best_match = color_name
    return best_match

def shrink_box(box, shrink_ratio=0.8):
    xmin, ymin, xmax, ymax = box
    width = xmax - xmin
    height = ymax - ymin
    new_width = width * shrink_ratio
    new_height = height * shrink_ratio
    center_x = xmin + width/2
    center_y = ymin + height/2
    new_xmin = int(center_x - new_width/2)
    new_ymin = int(center_y - new_height/2)
    new_xmax = int(center_x + new_width/2)
    new_ymax = int(center_y + new_height/2)
    return (new_xmin, new_ymin, new_xmax, new_ymax)

def get_dominant_color_from_crop(pil_image, box, shrink_ratio=0.8, k=3):
    new_box = shrink_box(box, shrink_ratio)
    crop = pil_image.crop(new_box)
    crop_np = np.array(crop)
    lab_crop = cv2.cvtColor(crop_np, cv2.COLOR_RGB2LAB)
    pixel_vals = lab_crop.reshape((-1, 3))
    pixel_vals = np.float32(pixel_vals)
    criteria = (cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    attempts = 10
    ret, labels, centers = cv2.kmeans(pixel_vals, k, None, criteria, attempts, cv2.KMEANS_RANDOM_CENTERS)
    counts = np.bincount(labels.flatten())
    dominant = centers[np.argmax(counts)]
    dominant = np.uint8(dominant)
    dominant_lab = np.array([[dominant]])
    dominant_rgb = cv2.cvtColor(dominant_lab, cv2.COLOR_LAB2RGB)
    return tuple(int(x) for x in dominant_rgb[0,0])

def add_dominant_color_info(pil_image, detections):
    dominant_colors = []
    color_names = []
    for idx, row in detections.iterrows():
        box = (int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax']))
        try:
            color = get_dominant_color_from_crop(pil_image, box, shrink_ratio=0.8, k=3)
            matched_color = match_color_lab(color)
        except Exception:
            color = None
            matched_color = "Unknown"
        dominant_colors.append(color)
        color_names.append(matched_color)
    detections['dominant_color'] = dominant_colors
    detections['color_name'] = color_names
    return detections

def annotate_image(img_rgb, detections):
    annotated = img_rgb.copy()
    for idx, row in detections.iterrows():
        xmin, ymin = int(row['xmin']), int(row['ymin'])
        xmax, ymax = int(row['xmax']), int(row['ymax'])
        box_color = (0, 255, 0)
        cv2.rectangle(annotated, (xmin, ymin), (xmax, ymax), box_color, 2)
        label = f"{row['name']} {row['confidence']:.2f} {row['color_name']}"
        cv2.putText(annotated, label, (xmin, max(ymin-10, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, box_color, 2)
    return annotated

def resize_image(image, max_width=800, max_height=600):
    width, height = image.size
    if width > max_width or height > max_height:
        ratio = min(max_width/width, max_height/height)
        new_width = int(width*ratio)
        new_height = int(height*ratio)
        return image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return image

# Пути к модели
model_weights_path = "C:/Users/morga/yolov5/runs/train/yolo_clothes3/weights/best.pt"
yolov5_repo_path = "C:/Users/morga/yolov5"

# Загрузка модели YOLOv5
model = torch.hub.load(yolov5_repo_path, 'custom', path=model_weights_path, source='local')

# Глобальная переменная: список загруженных изображений.
# Каждая запись – словарь с ключами 'original', 'annotated', 'detections', 'file_path'
images_data = []
current_index = 0

def process_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Не удалось открыть изображение")
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil_image_orig = Image.fromarray(img_rgb)
    results = model(img_rgb)
    detections = results.pandas().xyxy[0]
    detections = add_dominant_color_info(pil_image_orig, detections)
    annotated = annotate_image(img_rgb, detections)
    pil_image_annotated = Image.fromarray(annotated)
    return {
        'original': pil_image_orig,
        'annotated': pil_image_annotated,
        'detections': detections,
        'file_path': image_path
    }

def display_current_image():
    global images_data, current_index
    if images_data:
        data = images_data[current_index]
        pil_image = data['annotated']
        pil_image_resized = resize_image(pil_image)
        img_tk = ImageTk.PhotoImage(pil_image_resized)
        image_label.config(image=img_tk)
        image_label.image = img_tk

        result_text.delete("1.0", tk.END)
        result_text.insert(tk.END, f"Файл: {data['file_path']}\n")
        result_text.insert(tk.END, data['detections'].to_string(index=False))
        index_label.config(text=f"Изображение {current_index+1} из {len(images_data)}")

def choose_files():
    global images_data, current_index
    file_paths = filedialog.askopenfilenames(filetypes=[("Image Files", "*.jpg;*.png")])
    if not file_paths:
        return
    images_data.clear()
    for file_path in file_paths:
        try:
            data = process_image(file_path)
            images_data.append(data)
        except Exception as e:
            messagebox.showerror("Ошибка", f"{file_path}:\n{str(e)}")
    if images_data:
        current_index = 0
        display_current_image()
    else:
        messagebox.showinfo("Информация", "Ни одно изображение не обработалось успешно.")

def next_image():
    global current_index
    if images_data and current_index < len(images_data)-1:
        current_index += 1
        display_current_image()

def prev_image():
    global current_index
    if images_data and current_index > 0:
        current_index -= 1
        display_current_image()

# Методы оценки комплектов
def score_similar(combo):
    hues = []
    for item in combo:
        if item['color_name'] not in ['серый', 'чёрный', 'белый']:
            hue = get_hue_from_rgb(item['dominant_color'])
            hues.append(hue)
    if len(hues) < 2:
        return 0
    total = 0
    count = 0
    for i in range(len(hues)):
        for j in range(i+1, len(hues)):
            d = min(abs(hues[i]-hues[j]), 360-abs(hues[i]-hues[j]))
            total += d
            count += 1
    return total/count

def score_contrast(combo):
    return -score_similar(combo)

def score_monochrome(combo):
    hues = []
    for item in combo:
        if item['color_name'] not in ['серый', 'чёрный', 'белый']:
            hue = get_hue_from_rgb(item['dominant_color'])
            hues.append(hue)
    if not hues:
        return 0
    avg = sum(hues)/len(hues)
    var = sum((h-avg)**2 for h in hues)/len(hues)
    return var

def score_complementary(combo):
    hues = []
    for item in combo:
        if item['color_name'] not in ['серый', 'чёрный', 'белый']:
            hue = get_hue_from_rgb(item['dominant_color'])
            hues.append(hue)
    if len(hues) < 2:
        return float('inf')
    total = 0
    count = 0
    for i in range(len(hues)):
        for j in range(i+1, len(hues)):
            d = min(abs(hues[i]-hues[j]), 360-abs(hues[i]-hues[j]))
            total += abs(d-180)
            count += 1
    return total/count

def score_random(combo):
    return random.random()

# Глобальная переменная для хранения рекомендованных комплектов.
# Ключ – метод, значение – (список элементов, score)
current_recommended_outfits = {}

def recommend_outfits():
    items_by_category = {}
    for data in images_data:
        detections = data['detections']
        if not detections.empty:
            row = detections.iloc[0]
            category = row['name']
            item = {
                'file_path': data['file_path'],
                'image': data['original'],  # ключ image берется из original
                'dominant_color': row['dominant_color'],
                'color_name': row['color_name'],
                'detections': data['detections']
            }
            items_by_category.setdefault(category, []).append(item)
    if not items_by_category:
        messagebox.showinfo("Информация", "Нет доступных предметов для рекомендации.")
        return
    categories = list(items_by_category.keys())
    all_combos = list(itertools.product(*(items_by_category[cat] for cat in categories)))
    unique_combos = []
    for combo in all_combos:
        file_paths = [item['file_path'] for item in combo]
        if len(set(file_paths)) == len(file_paths):
            unique_combos.append(combo)
    if not unique_combos:
        messagebox.showinfo("Информация", "Не удалось сформировать уникальные комплекты (все повторяются).")
        return
    methods = {
        "Похожие цвета": score_similar,
        "Контрастные цвета": score_contrast,
        "Монохромный": score_monochrome,
        "Комплементарные": score_complementary,
        "Случайный": score_random
    }
    used_file_paths = set()
    best_combos = {}
    for method_name, func in methods.items():
        sorted_combos = sorted(unique_combos, key=func)
        chosen_combo = None
        chosen_score = None
        for combo in sorted_combos:
            c_paths = {item['file_path'] for item in combo}
            if c_paths.isdisjoint(used_file_paths):
                chosen_score = func(combo)
                chosen_combo = list(combo)  # сохраняем как список для возможности модификации
                used_file_paths.update(c_paths)
                break
        best_combos[method_name] = (chosen_combo, chosen_score)
    global current_recommended_outfits
    current_recommended_outfits = best_combos.copy()
    
    global rec_win
    rec_win = tk.Toplevel(root)
    rec_win.title("Рекомендуемые комплекты")
    # Используем скроллируемую область для окна с комплектами
    scroll_frame = create_scrollable_frame(rec_win, width=900, height=500)
    update_recommended_window(scroll_frame)
    rec_win.mainloop()

def update_recommended_window(container):
    # container – скроллируемый фрейм, куда размещаются рекомендации
    for widget in container.winfo_children():
        widget.destroy()
    for method_name, (combo, score) in current_recommended_outfits.items():
        frame = tk.Frame(container, borderwidth=2, relief="groove", pady=5)
        frame.pack(pady=5, padx=5, fill="x")
        if combo is None:
            tk.Label(frame, text=f"{method_name}: не удалось найти уникальный комплект",
                     font=("Arial", 12, "bold")).pack()
            continue
        tk.Label(frame, text=f"{method_name} (оценка: {score:.1f})",
                 font=("Arial", 12, "bold")).pack()
        for i, item in enumerate(combo):
            elem_frame = tk.Frame(frame, pady=2)
            elem_frame.pack(fill="x", padx=5)
            thumb = resize_image(item['image'], max_width=100, max_height=100)
            img_tk = ImageTk.PhotoImage(thumb)
            img_label = tk.Label(elem_frame, image=img_tk)
            img_label.image = img_tk
            img_label.pack(side="left", padx=5)
            info = tk.Label(elem_frame, text=f"{item['color_name']}\n{item['file_path'].split('/')[-1]}",
                            font=("Arial", 10))
            info.pack(side="left", padx=5)
            rep_btn = tk.Button(elem_frame, text="Заменить", bg="#FFC107",
                                command=lambda m=method_name, idx=i: open_replacement_options(m, idx))
            rep_btn.pack(side="left", padx=5)

def open_replacement_options(method, element_index):
    outfit, score = current_recommended_outfits[method]
    category = outfit[element_index]['detections'].iloc[0]['name']
    alternatives = []
    for data in images_data:
        if not data['detections'].empty:
            cat = data['detections'].iloc[0]['name']
            if cat == category:
                alt_item = {
                    'file_path': data['file_path'],
                    'image': data['original'],
                    'dominant_color': data['detections'].iloc[0]['dominant_color'],
                    'color_name': data['detections'].iloc[0]['color_name'],
                    'detections': data['detections']
                }
                if alt_item not in outfit:
                    alternatives.append(alt_item)
    if not alternatives:
        messagebox.showinfo("Информация", f"Нет альтернатив для категории {category}.")
        return
    alt_win = tk.Toplevel(root)
    alt_win.title("Выберите замену")
    scroll_alt = create_scrollable_frame(alt_win, width=500, height=300)
    for i, item in enumerate(alternatives):
        thumb = resize_image(item['image'], max_width=100, max_height=100)
        img_tk = ImageTk.PhotoImage(thumb)
        btn = tk.Button(scroll_alt, image=img_tk,
                        command=lambda i=i: select_replacement(method, element_index, alternatives[i], alt_win))
        btn.image = img_tk
        btn.grid(row=i//4, column=i%4, padx=5, pady=5)
    alt_win.mainloop()

def select_replacement(method, element_index, new_data, alt_win):
    outfit, score = current_recommended_outfits[method]
    outfit[element_index] = new_data
    current_recommended_outfits[method] = (outfit, score)
    alt_win.destroy()
    update_recommended_window(rec_win)

def generate_outfit_based_on_element():
    if not images_data:
        messagebox.showinfo("Информация", "Нет загруженных изображений.")
        return
    win = tk.Toplevel(root)
    win.title("Выберите базовый элемент")
    # Создаем скроллируемую область для выбора базового элемента
    scroll_frame = create_scrollable_frame(win, width=500, height=400)
    for i, data in enumerate(images_data):
        if not data['detections'].empty:
            frame = tk.Frame(scroll_frame, borderwidth=1, relief="solid", pady=5, padx=5)
            frame.pack(pady=5, padx=5, fill="x")
            thumb = resize_image(data['original'], max_width=100, max_height=100)
            img_tk = ImageTk.PhotoImage(thumb)
            img_label = tk.Label(frame, image=img_tk)
            img_label.image = img_tk
            img_label.pack(side="left", padx=5)
            category = data['detections'].iloc[0]['name']
            file_name = data['file_path'].split('/')[-1]
            info = tk.Label(frame, text=f"{i}: {category} - {file_name}", font=("Arial", 12))
            info.pack(side="left", padx=5)
            btn = tk.Button(frame, text="Выбрать", command=lambda idx=i: on_select_base(idx, win))
            btn.pack(side="right", padx=5)
    win.mainloop()

def on_select_base(index, win):
    base_item = images_data[index]
    base_category = base_item['detections'].iloc[0]['name']
    items_by_category = {}
    items_by_category[base_category] = [base_item]
    for data in images_data:
        if not data['detections'].empty:
            cat = data['detections'].iloc[0]['name']
            if cat == base_category:
                continue
            items_by_category.setdefault(cat, []).append(data)
    categories = list(items_by_category.keys())
    all_combos = list(itertools.product(*(items_by_category[cat] for cat in categories)))
    combo_win = tk.Toplevel(root)
    combo_win.title("Комплекты на основе выбранного элемента")
    scroll_combo = create_scrollable_frame(combo_win, width=900, height=500)
    for combo in all_combos:
        frame = tk.Frame(scroll_combo, borderwidth=2, relief="groove", pady=5)
        frame.pack(pady=5, padx=5, fill="x")
        text = ""
        for data in combo:
            cat = data['detections'].iloc[0]['name']
            file_name = data['file_path'].split('/')[-1]
            text += f"{cat}: {file_name}   "
        tk.Label(frame, text=text, font=("Arial", 12)).pack()
    win.destroy()

def edit_detections():
    global images_data, current_index
    if not images_data:
        return
    data = images_data[current_index]
    detections = data['detections']
    if detections.empty:
        messagebox.showinfo("Информация", "Нет результатов для редактирования.")
        return

    edit_win = tk.Toplevel(root)
    edit_win.title("Редактировать результаты детекции")

    class_vars = []
    color_vars = []
    clothing_options = ["hoodie", "tshirt", "pants", "jacket"]

    for idx, row in detections.iterrows():
        frame = tk.Frame(edit_win, borderwidth=1, relief="solid", pady=5, padx=5)
        frame.pack(pady=5, padx=5, fill="x")
        tk.Label(frame, text=f"Детекция {idx+1} - Класс:").grid(row=0, column=0, sticky="w")
        default_class = row['name'] if row['name'] in clothing_options else clothing_options[0]
        class_var = tk.StringVar(value=default_class)
        class_menu = tk.OptionMenu(frame, class_var, *clothing_options)
        class_menu.config(width=15)
        class_menu.grid(row=0, column=1, padx=5)
        class_vars.append(class_var)

        tk.Label(frame, text="Цвет:").grid(row=1, column=0, sticky="w")
        color_var = tk.StringVar(value=row['color_name'])
        color_menu = tk.OptionMenu(frame, color_var, *list(popular_colors.keys()))
        color_menu.config(width=15)
        color_menu.grid(row=1, column=1, padx=5)
        color_vars.append(color_var)

    def apply_edits():
        for i, (class_var, color_var) in enumerate(zip(class_vars, color_vars)):
            detections.at[i, 'name'] = class_var.get()
            detections.at[i, 'color_name'] = color_var.get()
        original = data['original']
        img_np = np.array(original)
        annotated = annotate_image(img_np, detections)
        data['annotated'] = Image.fromarray(annotated)
        data['detections'] = detections
        display_current_image()
        edit_win.destroy()

    tk.Button(edit_win, text="Применить изменения", command=apply_edits,
              font=("Arial", 12, "bold"), bg="#2196F3", fg="white").pack(pady=10)

def replace_element_in_outfit():
    if not current_recommended_outfits:
        messagebox.showinfo("Информация", "Сначала сгенерируйте рекомендованные комплекты.")
        return
    recommend_outfits()

# --- Основное окно приложения ---
root = tk.Tk()
root.title("YOLO Детекция и Определение Цвета Одежды")
root.geometry("1000x800")

choose_button = tk.Button(root, text="Выбрать изображения", command=choose_files, font=("Arial", 12))
choose_button.pack(pady=10)

index_label = tk.Label(root, text="", font=("Arial", 12))
index_label.pack()

image_label = tk.Label(root)
image_label.pack()

nav_frame = tk.Frame(root)
nav_frame.pack(pady=10)
prev_button = tk.Button(nav_frame, text="<< Предыдущее", command=prev_image, font=("Arial", 12))
prev_button.pack(side="left", padx=5)
next_button = tk.Button(nav_frame, text="Следующее >>", command=next_image, font=("Arial", 12))
next_button.pack(side="left", padx=5)

result_text = tk.Text(root, width=100, height=10, font=("Courier New", 10))
result_text.pack(pady=10)

rec_button = tk.Button(root, text="Рекомендовать комплекты", command=recommend_outfits,
                       font=("Arial", 12, "bold"), bg="#4CAF50", fg="white")
rec_button.pack(pady=10)

edit_button = tk.Button(root, text="Редактировать результаты", command=edit_detections,
                        font=("Arial", 12, "bold"), bg="#FF9800", fg="white")
edit_button.pack(pady=10)

gen_button = tk.Button(root, text="Создать комплект по выбранному элементу", command=generate_outfit_based_on_element,
                       font=("Arial", 12, "bold"), bg="#673AB7", fg="white")
gen_button.pack(pady=10)

replace_button = tk.Button(root, text="Заменить элемент в комплекте", command=replace_element_in_outfit,
                           font=("Arial", 12, "bold"), bg="#009688", fg="white")
replace_button.pack(pady=10)

root.mainloop()
