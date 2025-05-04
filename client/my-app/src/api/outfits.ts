import http from './http';
import { DetectionItem } from './index';

export interface OutfitDoc {
  _id: string;
  name: string;
  date: string;
  items: DetectionItem[];
  photo_uris: string[];
}

export async function saveOutfit(payload: {
  name: string;
  date: string;
  items: DetectionItem[];
  photo_uris: string[];
}) {
  await http.post('/outfits/', payload);
}

export async function listOutfits(): Promise<OutfitDoc[]> {
  const { data } = await http.get('/outfits/');
  return data;                 
}

export async function deleteOutfit(id: string) {
  await http.delete(`/outfits/${id}`);  
}
