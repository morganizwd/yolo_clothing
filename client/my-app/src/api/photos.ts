// api/photos.ts
import http       from './http';
import { API_URL } from './config';

/* минимальный дублированный тип, чтобы не тянуть весь index.ts */
export interface DetectionItem {
  image_id: string;
  index: number;
  name: string;
  confidence: number;
  bbox: [number, number, number, number];
  dominant_color: [number, number, number];
  color_name: string;
}

export interface SavedPhoto {
  _id: string;              // может отсутствовать у новых снимков
  uri_orig: string;         // абсолютный URL
  detections: DetectionItem[];
}

/* получить все фото пользователя */
export async function listPhotos(): Promise<SavedPhoto[]> {
  const { data } = await http.get('/photos/');
  return data.map((p: any) => ({
    ...p,
    uri_orig: API_URL + p.uri_orig,      // относительный путь → абсолютный
  }));
}

/* удалить фото (документ + файл) на сервере */
export async function deletePhoto(id: string) {
  if (!id) return;                 // нет _id → файл ещё не загружен на сервер
  await http.delete(`/photos/${id}`);
}

export async function updateDetections(photoId: string, detections: DetectionItem[]) {
  await http.patch(`/photos/${photoId}`, detections);
}