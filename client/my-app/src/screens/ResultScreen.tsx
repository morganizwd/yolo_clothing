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
import { Searchbar, Card, FAB, Button, ActivityIndicator } from 'react-native-paper';
import { AntDesign } from '@expo/vector-icons';
import { recommendOutfits, DetectionItem } from '../api';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SingleResult = {
    uri: string;
    detections: DetectionItem[];
};

type Recommendation = {
    method: string;
    score: number;
    items: (DetectionItem & { uri: string })[];
};

export default function ResultScreen({ route, navigation }: any) {
    const { results } = route.params as { results: SingleResult[] };
    const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
    const [openImages, setOpenImages] = useState<boolean[]>(results.map(() => true));
    const [openRecs, setOpenRecs] = useState<boolean[]>([]);
    const [selectedTab, setSelectedTab] = useState<'detections' | 'recommendations'>('detections');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandAll, setExpandAll] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalItem, setModalItem] = useState<DetectionItem & { uri: string } | null>(null);

    const scrollRef = useRef<ScrollView>(null);

    // Header title
    useLayoutEffect(() => {
        navigation.setOptions({
            title: 'Детекции и рекомендации',
            headerBackTitle: 'Назад',
        });
    }, [navigation]);

    // Aggregate detections with uri
    const allDetections: (DetectionItem & { uri: string })[] = results.flatMap((r) =>
        r.detections.map((d) => ({ ...d, uri: r.uri }))
    );

    useEffect(() => {
        (async () => {
            const rec = await recommendOutfits(allDetections);
            const withUris = rec.map((r) => ({
                ...r,
                items: r.items.map((item) => {
                    const orig = allDetections.find((d) => d.index === item.index);
                    return { ...item, uri: orig?.uri || '' };
                }),
            }));
            setRecommendations(withUris);
            setOpenRecs(withUris.map(() => false));
        })();
    }, []);

    if (!recommendations) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator animating size="large" />
                <Text style={styles.loadingText}>Генерируем рекомендации…</Text>
            </View>
        );
    }

    // Helpers for filtering
    const q = searchQuery.trim().toLowerCase();
    const matches = (d: DetectionItem) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.color_name && d.color_name.toLowerCase().includes(q));

    const filteredResults = results
        .map((r) => ({ ...r, detections: r.detections.filter(matches) }))
        .filter((r) => r.detections.length > 0);

    const filteredRecs = recommendations
        .map((r) => ({ ...r, items: r.items.filter(matches) }))
        .filter((r) => r.items.length > 0);

    const toggleSection = (idx: number, isRec: boolean) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (isRec) {
            setOpenRecs((prev) => prev.map((v, i) => (i === idx ? !v : v)));
        } else {
            setOpenImages((prev) => prev.map((v, i) => (i === idx ? !v : v)));
        }
    };

    const toggleAll = () => {
        const next = !expandAll;
        setExpandAll(next);
        setOpenImages(results.map(() => next));
        setOpenRecs(recommendations.map(() => next));
    };

    const openDetail = (item: DetectionItem & { uri: string }) => {
        setModalItem(item);
        setModalVisible(true);
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
            <View style={styles.tabsContainer}>
                {['detections', 'recommendations'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[
                            styles.tab,
                            selectedTab === tab && styles.tabActive,
                        ]}
                        onPress={() => setSelectedTab(tab as any)}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                selectedTab === tab && styles.tabTextActive,
                            ]}
                        >
                            {tab === 'detections' ? 'Детекции' : 'Рекомендации'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
                {selectedTab === 'detections' ? (
                    filteredResults.map((r, idx) => (
                        <Card key={idx} style={styles.card}>
                            <TouchableOpacity onPress={() => toggleSection(idx, false)}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.sectionTitle}>
                                        Изображение {idx + 1} ({r.detections.length})
                                    </Text>
                                    <AntDesign
                                        name={openImages[idx] ? 'down' : 'right'}
                                        size={18}
                                    />
                                </View>
                            </TouchableOpacity>
                            {openImages[idx] && (
                                <Card.Content>
                                    <Image source={{ uri: r.uri }} style={styles.fullImage} />
                                    {r.detections.map((d) => (
                                        <Text key={d.index} style={styles.detectText}>
                                            • <Text style={styles.detectName}>{d.name}</Text> ({d.color_name})
                                        </Text>
                                    ))}
                                </Card.Content>
                            )}
                        </Card>
                    ))
                ) : (
                    filteredRecs.map((r, idx) => (
                        <Card key={idx} style={styles.card}>
                            <TouchableOpacity onPress={() => toggleSection(idx, true)}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.scoreBadgeContainer}>
                                        <View
                                            style={[
                                                styles.scoreBadge,
                                                { backgroundColor: r.score >= 8 ? '#4caf50' : r.score >= 5 ? '#ff9800' : '#f44336' },
                                            ]}
                                        >
                                            <Text style={styles.scoreText}>{r.score.toFixed(1)}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.sectionTitle}>{r.method}</Text>
                                    <AntDesign
                                        name={openRecs[idx] ? 'down' : 'right'}
                                        size={18}
                                    />
                                </View>
                            </TouchableOpacity>
                            {openRecs[idx] && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flatList}>
                                    {r.items.map((item) => {
                                        const origW = item.bbox[2] - item.bbox[0];
                                        const origH = item.bbox[3] - item.bbox[1];
                                        const MAX = 100;
                                        const scale = Math.min(MAX / origW, MAX / origH, 1);
                                        const w = origW * scale;
                                        const h = origH * scale;
                                        return (
                                            <TouchableOpacity
                                                key={item.index}
                                                style={styles.outfitItem}
                                                onPress={() => openDetail(item)}
                                            >
                                                <Image
                                                    source={{ uri: item.uri }}
                                                    style={[styles.thumb, { width: w, height: h }]}
                                                />
                                                <Text style={styles.itemText} numberOfLines={2}>
                                                    {item.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            )}
                        </Card>
                    ))
                )}
            </ScrollView>

            {/* Floating Action Buttons */}
            <FAB
                icon="arrow-up"
                small
                style={[styles.fab, { bottom: 16 }]}
                onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            />
            <FAB
                icon={() => <AntDesign name="arrowsalt" size={24} color="#fff" />}
                small
                style={[styles.fab, { bottom: 80 }]}
                onPress={toggleAll}
            />

            {/* Modal for item detail */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <Card style={styles.modalCard}>
                        {modalItem && (
                            <>
                                <Image
                                    source={{ uri: modalItem.uri }}
                                    style={styles.modalImage}
                                />
                                <Card.Content>
                                    <Text style={styles.modalTitle}>{modalItem.name}</Text>
                                    <Text>Цвет: {modalItem.color_name}</Text>
                                </Card.Content>
                                <Button onPress={() => setModalVisible(false)}>Закрыть</Button>
                            </>
                        )}
                    </Card>
                </View>
            </Modal>
        </View>
    );
}

const screenW = Dimensions.get('window').width;

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
    card: { marginVertical: 6, borderRadius: 12, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#e6e6e6', padding: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: '#222' },
    fullImage: { width: '100%', height: 200, borderRadius: 6, backgroundColor: '#ccc', marginBottom: 8 },
    detectText: { fontSize: 16, marginBottom: 4, color: '#555' },
    detectName: { fontWeight: '600' },
    flatList: { paddingVertical: 8 },
    outfitItem: { marginRight: 16, width: 100, alignItems: 'center' },
    thumb: { borderRadius: 6, backgroundColor: '#ddd', marginBottom: 6 },
    itemText: { fontSize: 14, textAlign: 'center', color: '#333' },
    fab: { position: 'absolute', right: 16, backgroundColor: '#6200ee' },
    scoreBadgeContainer: { marginRight: 8 },
    scoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    scoreText: { color: '#fff', fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: screenW * 0.9, borderRadius: 12, overflow: 'hidden' },
    modalImage: { width: '100%', height: 250 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
});
