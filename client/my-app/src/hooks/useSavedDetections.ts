// src/hooks/useSavedDetections.ts
import { useEffect, useState } from 'react';
import { listPhotos, SavedPhoto } from '../api/photos';     // уже есть
import { DetectionItem } from '../api';

export function useSavedDetections() {
    const [items, setItems] = useState<DetectionItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const photos: SavedPhoto[] = await listPhotos();
                const dets = photos.flatMap(p =>
                    p.detections.map(d => ({ ...d, uri: p.uri_orig })),
                );
                setItems(dets);
            } finally {
                setLoaded(true);
            }
        })();
    }, []);

    /** если данные ещё грузятся — вернём пустой массив,
        пусть UI сам покажет крутилку */
    return loaded ? items : [];
}