// src/hooks/useSavedDetections.ts
import { useEffect, useState } from 'react';
import { listPhotos, SavedPhoto } from '../api/photos';   
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

    return loaded ? items : [];
}