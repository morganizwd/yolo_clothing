import http      from './http';
import { API_URL } from './config';

/* ——— скопирован из index.ts, чтобы не тянуть весь модуль ——— */
export interface DetectionItem {
  image_id: string;
  index:     number;
  name:      string;
  confidence: number;
  bbox:      [number, number, number, number];
  dominant_color: [number, number, number];
  color_name: string;
}
/* ———————————————————————————————————————————————— */

export interface SavedPhoto {
  _id:       string;
  uri_orig:  string;          // абсолютный URL
  detections: DetectionItem[];
}

/** вернуть все фото текущего пользователя */
export async function listPhotos(): Promise<SavedPhoto[]> {
  const { data } = await http.get('/photos/');      // Authorization уже есть
  return data.map((p: any) => ({
    ...p,
    uri_orig: API_URL + p.uri_orig,                // относ. → абсолютный
  }));
}
