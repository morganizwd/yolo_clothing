// src/api/index.ts
import axios from 'axios';
import { API_URL } from './config';
import http from './http';

export interface DetectionItem {
    image_id: string;
    index: number;
    name: string;
    confidence: number;
    bbox: [number, number, number, number];
    dominant_color: [number, number, number];
    color_name: string;
}

export async function detectImage(uri: string): Promise<DetectionItem[]> {
    const form = new FormData();
    form.append('file', {
        uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
    } as any);

    const res = await http.post<DetectionItem[]>('/detect/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
}

export async function annotateImage(
    uri: string,
    edits?: Record<number, { name?: string; color_name?: string }>
): Promise<string> {
    const form = new FormData();
    form.append('file', {
        uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
    } as any);

    if (edits) {
        form.append('edits', JSON.stringify({ edits }));
    }

    const res = await client.post('/annotate', form, {
        responseType: 'blob',
    });
    return URL.createObjectURL(res.data);
}

export async function recommendOutfits(
    detections: DetectionItem[],
  ): Promise<any[]> {
    try {
      const { data } = await http.post('/recommend/', { detections });
      return data;                      
    } catch (err: any) {
      if (err?.response?.status === 400) return [];
      throw err;                         
    }
  }