// src/screens/WeatherScreen.tsx
import React, { useState, useRef, useLayoutEffect } from 'react';
import {
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Image,
    View,
    Animated,
    Easing,
} from 'react-native';
import {
    Appbar,
    TextInput,
    Button,
    Snackbar,
    ActivityIndicator,
    Card,
    Text,
} from 'react-native-paper';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';

import { useSavedDetections } from '../hooks/useSavedDetections';
import { getWeatherByCoords } from '../api/weather';
import { recommendOutfits, DetectionItem } from '../api';

/* ────── types ────── */
type Recommendation = {
    method: string;
    score: number;
    items: (DetectionItem & { uri: string })[];
};

/* ────── helpers ────── */
const getWeatherIcon = (t: number) =>
    t >= 20 ? 'weather-sunny' : t >= 10 ? 'weather-partly-cloudy' : 'weather-snowy';

/* ==================================================== */
export default function WeatherScreen({ navigation }: any) {
    /* state */
    const [city, setCity] = useState('');
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const [place, setPlace] = useState<{
        title: string;
        lat: number;
        lon: number;
        temp: number;
        note: string;
    } | null>(null);
    const [recs, setRecs] = useState<Recommendation[] | null>(null);

    const saved = useSavedDetections();

    /* header */
    useLayoutEffect(() => {
        navigation.setOptions({
            header: () => (
                <Appbar.Header>
                    <Appbar.BackAction onPress={() => navigation.goBack()} />
                    <Appbar.Content title="Одежда по погоде" />
                </Appbar.Header>
            ),
        });
    }, [navigation]);

    /* animation */
    const fade = useRef(new Animated.Value(0)).current;
    const animateIn = () => {
        fade.setValue(0);
        Animated.timing(fade, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
        }).start();
    };

    /* main action */
    const onSubmit = async () => {
        if (!city) return setToast('Введите город');
        try {
            setBusy(true);

            /* ── geocode ── */
            const [geo] = await Location.geocodeAsync(city);
            if (!geo) throw new Error('Город не найден');
            const { latitude: lat, longitude: lon } = geo;

            /* human‑readable название */
            const [rev] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
            const title = [rev.city || rev.name, rev.region, rev.country]
                .filter(Boolean)
                .join(', ');

            /* температура */
            const temp = await getWeatherByCoords(lat, lon);

            /* правило */
            let need: string[], note: string;
            if (temp >= 20) {
                need = ['tshirt', 'pants'];
                note = 'Тёплая погода — хватит футболки и брюк';
            } else if (temp >= 10) {
                need = ['tshirt', 'pants', 'hoodie'];
                note = 'Прохладно — добавьте худи';
            } else {
                need = ['tshirt', 'pants', 'hoodie', 'jacket'];
                note = 'Холодно — пригодятся худи и куртка';
            }

            /* фильтр гардероба */
            const pool = saved.filter((d) => need.includes(d.name));
            if (!pool.length) throw new Error('В гардеробе нет подходящих вещей');

            /* рекомендации */
            const resp = await recommendOutfits(pool);
            const withUris = resp.map((r) => ({
                ...r,
                items: r.items.map((it) => {
                    const src = pool.find((d) => d.image_id === it.image_id && d.index === it.index);
                    return { ...it, uri: src?.uri ?? '' };
                }),
            }));

            setPlace({ title, lat, lon, temp, note });
            setRecs(withUris);
            animateIn();
        } catch (e: any) {
            console.warn(e);
            setToast(e.message || 'Ошибка');
        } finally {
            setBusy(false);
        }
    };

    /* render */
    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                {/* input */}
                <TextInput
                    label="Город"
                    value={city}
                    onChangeText={setCity}
                    style={{ marginBottom: 16 }}
                />

                {busy ? (
                    <ActivityIndicator style={{ marginBottom: 16 }} />
                ) : (
                    <Button mode="contained" onPress={onSubmit}>
                        Подобрать
                    </Button>
                )}

                {/* result */}
                {place && recs && (
                    <Animated.View
                        style={[
                            styles.result,
                            {
                                opacity: fade,
                                transform: [
                                    {
                                        scale: fade.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.96, 1],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <Card style={styles.card}>
                            {/* hero */}
                            <View style={styles.hero}>
                                <Image
                                    style={styles.map}
                                    source={{
                                        uri:
                                            `https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&` +
                                            `width=800&height=450&center=lonlat:${place.lon},${place.lat}&` +
                                            `zoom=12&marker=lonlat:${place.lon},${place.lat};color:%23ff2e63;size:large&` +
                                            `apiKey=8ff82013b3ef491abf62049b85060740`,
                                    }}
                                />
                                <View style={styles.overlay} />
                                <View style={styles.tempWrap}>
                                    <MaterialIcon
                                        name={getWeatherIcon(place.temp)}
                                        size={44}
                                        color="#fff"
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={styles.tempTxt}>{place.temp.toFixed(1)}°С</Text>
                                </View>
                            </View>

                            {/* название города / пояснение */}
                            <Card.Content style={styles.titleBox}>
                                <Text style={styles.city}>{place.title}</Text>
                                <Text style={styles.note}>{place.note}</Text>
                            </Card.Content>

                            {/* outfits */}
                            <Card.Content style={{ paddingBottom: 12 }}>
                                {recs.map((r) => (
                                    <View key={r.method} style={{ marginTop: 18 }}>
                                        <Text style={styles.method}>
                                            {r.method}  •  {r.score.toFixed(1)}
                                        </Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {r.items.map((it) => (
                                                <Image
                                                    key={`${it.image_id}-${it.index}`}
                                                    source={{ uri: it.uri }}
                                                    style={styles.item}
                                                />
                                            ))}
                                        </ScrollView>
                                    </View>
                                ))}
                            </Card.Content>
                        </Card>
                    </Animated.View>
                )}
            </ScrollView>

            <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={3000}>
                {toast}
            </Snackbar>
        </KeyboardAvoidingView>
    );
}

/* ────── styles ────── */
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#fafafa' },

    /* отступ между кнопкой и карточкой */
    result: { marginTop: 24 },

    card: {
        borderRadius: 16,
        elevation: 3,
        overflow: 'hidden',
        backgroundColor: '#fff',
    },

    hero: { width: '100%', aspectRatio: 16 / 9 },
    map: { width: '100%', height: '100%' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
    tempWrap: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tempTxt: { fontSize: 42, color: '#fff', fontWeight: '700' },

    /* блок названия и пояснения */
    titleBox: { paddingTop: 16 },
    city: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 4,
        lineHeight: 24,
        flexShrink: 1,              // <<< — позволяет заголовку переноситься
    },
    note: { fontSize: 15, color: '#555' },

    method: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
    item: {
        width: 110,
        height: 110,
        marginRight: 10,
        borderRadius: 10,
        backgroundColor: '#ddd',
    },
});
