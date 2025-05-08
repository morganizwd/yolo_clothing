import os

# Укажите путь к папке с вашими .txt файлами
folder_path = r'C:\Users\morga\yolov5\csdataset2'

# Словарь для замены номеров классов
class_mapping = {
    '1': '0',
    '2': '1',
    '3': '2',
}

# Проход по всем файлам в папке
for filename in os.listdir(folder_path):
    if filename.endswith('.txt'):  # Ищем только txt файлы
        file_path = os.path.join(folder_path, filename)

        # Читаем содержимое файла
        with open(file_path, 'r') as file:
            lines = file.readlines()

        # Модифицируем строки, заменяя номера классов
        modified_lines = []
        for line in lines:
            parts = line.split()  # Разделяем строку на части
            class_number = parts[0]  # Первый элемент — это номер класса
            if class_number in class_mapping:
                parts[0] = class_mapping[class_number]  # Меняем номер класса
            modified_lines.append(' '.join(parts))  # Собираем строку обратно

        # Записываем изменения обратно в файл
        with open(file_path, 'w') as file:
            file.write('\n'.join(modified_lines))

print("Замена номеров классов завершена.")