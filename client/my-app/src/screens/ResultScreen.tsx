// src/screens/ResultScreen.tsx
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    TouchableOpacity,
    Modal,
    LayoutAnimation,
    UIManager,
    Platform,
    StyleSheet,
    Dimensions,
    StatusBar,
} from 'react-native';
import {
    Searchbar,
    Card,
    FAB,
    Button,
    ActivityIndicator,
    Portal,
    Dialog,
} from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { AntDesign } from '@expo/vector-icons';
import { recommendOutfits, DetectionItem } from '../api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SingleResult = { uri: string; detections: DetectionItem[] };
type Recommendation = {
    method: string;
    score: number;
    items: (DetectionItem & { uri: string })[];
};

const clothingOptions = ['hoodie', 'tshirt', 'pants', 'jacket'];  // <-- дополняйте!
const colorOptions = [
    'белый', 'чёрный', 'красный', 'лаймовый', 'синий', 'жёлтый', 'циан', 'магента',
    'серебряный', 'серый', 'бордовый', 'оливковый', 'зелёный', 'фиолетовый', 'бирюзовый',
    'тёмно-синий', 'оранжевый', 'розовый', 'коричневый', 'золотой', 'бежевый', 'коралловый',
    'слоновая кость', 'хаки', 'лавандовый', 'сливовый', 'орхидейный', 'лососевый', 'загорелый',
    'фиалковый', 'бирюзовый светлый', 'индиго', 'шоколадный', 'багровый', 'лазурный',
    'мятный', 'нежно-розовый', 'рубиновый', 'сапфировый', 'изумрудный', 'янтарный',
    'бургундский', 'церулеевый', 'перивинкл', 'мув', 'горчичный', 'джинсовый', 'медный',
    'бронзовый', 'оливково-серый'
];

export default function ResultScreen({ route, navigation }: any) {
    const { results } = route.params as { results: SingleResult[] };
    const [detectionsByImage, setDetectionsByImage] = useState<SingleResult[]>(
        () => results.map(r => ({ ...r, detections: [...r.detections] }))
    );
    const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
    const [openImages, setOpenImages] = useState<boolean[]>(results.map(() => true));
    const [openRecs, setOpenRecs] = useState<boolean[]>([]);
    const [selectedTab, setSelectedTab] = useState<'detections' | 'recommendations'>('detections');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandAll, setExpandAll] = useState(true);

    // для модалки редактирования
    const [editVisible, setEditVisible] = useState(false);
    const [editImageIdx, setEditImageIdx] = useState(0);
    const [editDetIdx, setEditDetIdx] = useState(0);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    const scrollRef = useRef<ScrollView>(null);
    const makeKey = (d: DetectionItem) => `${d.image_id}-${d.index}`;

    // заголовок
    useLayoutEffect(() => {
        navigation.setOptions({ title: 'Детекции и рекомендации', headerBackTitle: 'Назад' });
    }, [navigation]);

    // собрать все детекции
    const allDetections: (DetectionItem & { uri: string })[] = detectionsByImage.flatMap(r =>
        r.detections.map(d => ({ ...d, uri: r.uri }))
    );

    // функция пересчёта рекомендаций
    const recalc = async () => {
        const rec = await recommendOutfits(allDetections);
        const withUris = rec.map(r => ({
            ...r,
            items: r.items.map(it => {
                const orig = allDetections.find(d => d.index === it.index && d.image_id === it.image_id);
                return { ...it, uri: orig?.uri || '' };
            }),
        }));
        setRecommendations(withUris);
        setOpenRecs(withUris.map(() => false));
    };

    useEffect(() => { recalc() }, []);

    if (!recommendations) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator animating size="large" />
                <Text style={styles.loadingText}>Генерируем рекомендации…</Text>
            </View>
        );
    }

    // фильтрация
    const q = searchQuery.trim().toLowerCase();
    const matches = (d: DetectionItem) =>
        !q || d.name.toLowerCase().includes(q) || (d.color_name?.toLowerCase().includes(q));

    const filteredResults = detectionsByImage
        .map(r => ({ ...r, detections: r.detections.filter(matches) }))
        .filter(r => r.detections.length);

    const filteredRecs = recommendations
        .map(r => ({ ...r, items: r.items.filter(matches) }))
        .filter(r => r.items.length);

    // разворачивание секций
    const toggleSection = (idx: number, rec: boolean) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (rec) setOpenRecs(p => p.map((v, i) => i === idx ? !v : v));
        else setOpenImages(p => p.map((v, i) => i === idx ? !v : v));
    };
    const toggleAll = () => {
        const next = !expandAll;
        setExpandAll(next);
        setOpenImages(detectionsByImage.map(() => next));
        setOpenRecs(recommendations.map(() => next));
    };

    // открыть модалку
    const openEdit = (imgIdx: number, detIdx: number) => {
        const det = detectionsByImage[imgIdx].detections[detIdx];
        setEditImageIdx(imgIdx);
        setEditDetIdx(detIdx);
        setEditName(det.name);
        setEditColor(det.color_name);
        setEditVisible(true);
    };
    // сохранить правки
    const applyEdit = () => {
        setDetectionsByImage(prev => {
            const next = [...prev];
            next[editImageIdx] = {
                ...next[editImageIdx],
                detections: [...next[editImageIdx].detections]
            };
            next[editImageIdx].detections[editDetIdx].name = editName;
            next[editImageIdx].detections[editDetIdx].color_name = editColor;
            return next;
        });
        setEditVisible(false);
        setTimeout(recalc, 0);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Searchbar
                placeholder="Поиск по названию или цвету"
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.search}
            />

            {/* вкладки */}
            <View style={styles.tabsContainer}>
                {(['detections', 'recommendations'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, selectedTab === tab && styles.tabActive]}
                        onPress={() => setSelectedTab(tab)}
                    >
                        <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                            {tab === 'detections' ? 'Детекции' : 'Рекомендации'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* контент */}
            <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
                {selectedTab === 'detections'
                    ? filteredResults.map((r, imgIdx) => (
                        <Card key={imgIdx} style={styles.card} mode="contained">
                            <TouchableOpacity onPress={() => toggleSection(imgIdx, false)}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.sectionTitle}>
                                        Изображение {imgIdx + 1} ({r.detections.length})
                                    </Text>
                                    <AntDesign name={openImages[imgIdx] ? 'down' : 'right'} size={18} />
                                </View>
                            </TouchableOpacity>
                            {openImages[imgIdx] && (
                                <View style={styles.cardBody}>
                                    <Image source={{ uri: r.uri }} style={styles.fullImage} />
                                    {r.detections.map((det, detIdx) => (
                                        <View key={makeKey(det)} style={styles.detectRow}>
                                            <Text style={styles.detectText}>
                                                • <Text style={styles.detectName}>{det.name}</Text> ({det.color_name})
                                            </Text>
                                            <Button icon="pencil" compact onPress={() => openEdit(imgIdx, detIdx)} />
                                        </View>
                                    ))}
                                </View>
                            )}
                        </Card>
                    ))
                    : filteredRecs.map((rec, idx) => (
                        <Card key={idx} style={styles.card} mode="contained">
                            <TouchableOpacity onPress={() => toggleSection(idx, true)}>
                                <View style={styles.cardHeader}>
                                    <View style={[
                                        styles.scoreBadge,
                                        { backgroundColor: rec.score >= 8 ? '#4caf50' : rec.score >= 5 ? '#ff9800' : '#f44336' }
                                    ]}>
                                        <Text style={styles.scoreText}>{rec.score.toFixed(1)}</Text>
                                    </View>
                                    <Text style={styles.sectionTitle}>{rec.method}</Text>
                                    <AntDesign name={openRecs[idx] ? 'down' : 'right'} size={18} />
                                </View>
                            </TouchableOpacity>
                            {openRecs[idx] && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.flatList}
                                >
                                    {rec.items.map(it => {
                                        const w = Math.min(100, it.bbox[2] - it.bbox[0]);
                                        const h = Math.min(100, it.bbox[3] - it.bbox[1]);
                                        return (
                                            <View key={makeKey(it)} style={styles.outfitItem}>
                                                <Image source={{ uri: it.uri }} style={[styles.thumb, { width: w, height: h }]} />
                                                <Text style={styles.itemText} numberOfLines={2}>{it.name}</Text>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            )}
                        </Card>
                    ))
                }
            </ScrollView>

            {/* FAB */}
            <FAB icon="arrow-up" small style={[styles.fab, { bottom: 16 }]}
                onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
            <FAB icon={() => <AntDesign name="arrowsalt" size={22} color="#fff" />}
                small style={[styles.fab, { bottom: 78 }]} onPress={toggleAll} />

            {/* диалог редактирования */}
            <Portal>
                <Dialog visible={editVisible} onDismiss={() => setEditVisible(false)}>
                    <Dialog.Title>Редактировать детекцию</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ marginBottom: 6 }}>Класс одежды</Text>
                        <Picker
                            selectedValue={editName}
                            onValueChange={setEditName}
                            style={{ marginBottom: 12 }}
                        >
                            {clothingOptions.map(c => (
                                <Picker.Item key={c} label={c} value={c} />
                            ))}
                        </Picker>

                        <Text style={{ marginBottom: 6 }}>Цвет</Text>
                        <Picker
                            selectedValue={editColor}
                            onValueChange={setEditColor}
                        >
                            {colorOptions.map(c => (
                                <Picker.Item key={c} label={c} value={c} />
                            ))}
                        </Picker>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setEditVisible(false)}>Отмена</Button>
                        <Button onPress={applyEdit}>Сохранить</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

const { width: screenW } = Dimensions.get('window');
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fafafa' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, fontSize: 16, color: '#555' },
    search: { margin: 12, borderRadius: 24 },
    tabsContainer: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, borderRadius: 24, overflow: 'hidden', backgroundColor: '#e0e0e0' },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
    tabActive: { backgroundColor: '#fff' },
    tabText: { fontSize: 16, color: '#555' },
    tabTextActive: { color: '#000', fontWeight: '600' },
    scrollContent: { paddingBottom: 120, paddingHorizontal: 12 },
    card: { marginVertical: 6, borderRadius: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e6e6e6', padding: 12 },
    cardBody: { padding: 12 },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: '#222' },
    fullImage: { width: '100%', height: 200, borderRadius: 6, backgroundColor: '#ccc', marginBottom: 8 },
    detectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    detectText: { fontSize: 15, color: '#555', flex: 1 },
    detectName: { fontWeight: '600' },
    flatList: { paddingVertical: 8 },
    outfitItem: { marginRight: 16, width: 100, alignItems: 'center' },
    thumb: { borderRadius: 6, backgroundColor: '#ddd', marginBottom: 6 },
    itemText: { fontSize: 13, textAlign: 'center', color: '#333' },
    scoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
    scoreText: { color: '#fff', fontWeight: '600' },
    fab: { position: 'absolute', right: 16, backgroundColor: '#6200ee' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: screenW * 0.9, borderRadius: 12 },
    modalImage: { width: '100%', height: 250 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
});
