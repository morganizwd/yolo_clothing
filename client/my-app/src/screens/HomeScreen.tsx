import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    ScrollView,
    StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
    Appbar,
    Button,
    Card,
    ActivityIndicator,
    FAB,
    Snackbar,
    Text,
    Portal,
} from 'react-native-paper';
import { detectImage, DetectionItem } from '../api';

type SingleResult = {
    uri: string;
    detections: DetectionItem[];
};

export default function HomeScreen({ navigation }: any) {
    const [uris, setUris] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);

    useLayoutEffect(() => {
        navigation.setOptions({
            header: () => (
                <Appbar.Header>
                    <Appbar.Content title="Главная" />
                </Appbar.Header>
            ),
        });
    }, [navigation]);

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                setSnackbar('Доступ к галерее не разрешен');
            }
        })();
    }, []);

    const pickImages = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
            });
            if ('assets' in result) {
                if (!result.canceled && result.assets.length > 0) {
                    setUris(result.assets.map(a => a.uri));
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                }
            } else if (!result.cancelled) {
                setUris([result.uri]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
            }
        } catch (e) {
            console.error(e);
            setSnackbar('Не удалось открыть галерею');
        }
    };

    const handleDetectAll = async () => {
        if (uris.length === 0) {
            return setSnackbar('Выберите хотя бы одно фото');
        }
        setLoading(true);
        try {
            const allResults: SingleResult[] = [];
            for (const uri of uris) {
                const detections = await detectImage(uri);
                allResults.push({ uri, detections });
            }
            navigation.navigate('Result', { results: allResults });
        } catch (e: any) {
            console.error(e);
            setSnackbar(e.message || 'Что-то пошло не так');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Инструкция пользователю */}
            <View style={styles.infoContainer}>
                <Text>Добро пожаловать в демо-приложение по распознаванию одежды.</Text>
                <Text>1. Нажмите "Выбрать фото" и загрузите не менее 15 фотографий ваших элементов гардероба.</Text>
                <Text>2. Чем больше фото — тем точнее рекомендации.</Text>
                <Text>3. После загрузки нажмите "Распознать все".</Text>
                <Text>4. Результаты могут быть неточными — рассматривайте их как пример.</Text>
            </View>

            <ScrollView
                horizontal
                ref={scrollRef}
                showsHorizontalScrollIndicator={false}
                style={styles.previewContainer}
                contentContainerStyle={styles.previewContent}
            >
                {uris.map(u => (
                    <Card key={u} style={styles.previewCard}>
                        <Card.Cover source={{ uri: u }} style={styles.previewImage} />
                    </Card>
                ))}
            </ScrollView>

            <View style={styles.actionsContainer}>
                <Button
                    mode="contained"
                    icon="image-multiple"
                    onPress={pickImages}
                    style={styles.actionButton}
                >
                    Выбрать фото
                </Button>
                {loading ? (
                    <ActivityIndicator animating size="large" style={styles.loader} />
                ) : (
                    <Button
                        mode="contained"
                        icon="magnify"
                        onPress={handleDetectAll}
                        disabled={!uris.length}
                        style={styles.actionButton}
                    >
                        Распознать все
                    </Button>
                )}
            </View>

            <Portal.Host>
                <Portal>
                    <FAB
                        icon="trash-can-outline"
                        small
                        style={[styles.fab, { bottom: 90 }]}
                        onPress={() => setUris([])}
                        disabled={!uris.length}
                    />
                    <FAB
                        icon="chevron-right"
                        style={[styles.fab, { bottom: 20 }]}
                        onPress={handleDetectAll}
                        disabled={!uris.length || loading}
                    />
                </Portal>
            </Portal.Host>

            <Snackbar
                visible={!!snackbar}
                onDismiss={() => setSnackbar(null)}
                duration={3000}
            >
                {snackbar}
            </Snackbar>
        </View>
    );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fafafa' },
    infoContainer: {
        padding: 16,
        backgroundColor: '#e0f7fa',
        margin: 12,
        borderRadius: 8,
    },
    previewContainer: { maxHeight: 140, marginVertical: 16 },
    previewContent: { paddingHorizontal: 12 },
    previewCard: { width: 120, marginRight: 12, borderRadius: 8, overflow: 'hidden' },
    previewImage: { height: 120 },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginHorizontal: 12,
        marginTop: 8,
    },
    actionButton: { flex: 1, marginHorizontal: 6 },
    loader: { marginLeft: 16 },
    fab: {
        position: 'absolute',
        right: 16,
        backgroundColor: '#6200ee',
    },
});
