// src/screens/HomeScreen.tsx
import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Appbar,
  Button,
  Card,
  FAB,
  Snackbar,
  Text,
  Portal,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

import { detectImage, DetectionItem } from '../api';
import { listPhotos, SavedPhoto } from '../api/photos';

type SingleResult = { uri: string; detections: DetectionItem[] };

export default function HomeScreen({ navigation }: any) {
  const [uris, setUris] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  /* обновляем список сохранённых фото при фокусе экрана */
  useFocusEffect(useCallback(() => {
    let mounted = true;
    (async () => {
      setSyncing(true);
      try {
        const photos = await listPhotos();
        if (mounted) setSaved(photos);
      } catch (err) {
        console.warn(err);
      } finally {
        if (mounted) setSyncing(false);
      }
    })();
    return () => { mounted = false; };
  }, []));

  /* настраиваем Header */
  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <Appbar.Header elevated style={{ backgroundColor: '#fff' }}>
          <Appbar.Content title="Главная" titleStyle={styles.headerTitle} />
        </Appbar.Header>
      ),
    });
  }, [navigation]);

  /* запрашиваем разрешения на галерею */
  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setSnackbar('Доступ к галерее не разрешён');
      }
    })();
  }, []);

  /* выбор фотографий */
  const pickImages = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!res.canceled) {
        const assets = ('assets' in res ? res.assets : [res]).map(a => a.uri);
        setUris(assets);
      }
    } catch {
      setSnackbar('Не удалось открыть галерею');
    }
  };

  /* распознаём все выбранные фото */
  const handleDetectAll = async () => {
    if (!uris.length) {
      setSnackbar('Выберите хотя бы одно фото');
      return;
    }
    setLoading(true);
    try {
      const results: SingleResult[] = [];
      for (const uri of uris) {
        const detections = await detectImage(uri);
        results.push({ uri, detections });
      }
      navigation.navigate('Result', { results });
      // сразу сбрасываем выбор, чтобы превью исчезли при возврате
      setUris([]);
    } catch (e: any) {
      setSnackbar(e.message || 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  };

  /* открываем ранее сохранённые фото */
  const openSaved = () => {
    if (!saved.length) {
      setSnackbar('Нет сохранённых фото');
      return;
    }
    const results = saved.map(p => ({
      _id: p._id,            // id нужен для возможности удалять на экране результатов
      uri: p.uri_orig,
      detections: p.detections,
    }));
    navigation.navigate('Result', { results });
    // сбрасываем текущее выделение
    setUris([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Hero-блок */}
      <LinearGradient
        colors={['#FF8A65', '#FF7043']}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View entering={FadeInUp.delay(100)}>
          <Text variant="headlineMedium" style={styles.heroTitle}>
            Распознавание гардероба
          </Text>
          <Text variant="headlineMedium" style={styles.heroTitle}>
            FAQ
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Загрузите фото своих вещей, и мы подскажем идеи образов!
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Это демо версия приложения, поэтому распознавание может работать не достаточно корректно!
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Для лучшего результата рекомендуется загружать от 20 фотографий элементов вашего гардероба.
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Сейчас достпуны для распознавания: худи, штаны, куртки, футболки.
          </Text>
        </Animated.View>
      </LinearGradient>

      {/* Превью выбранных фото */}
      {uris.length > 0 && (
        <Animated.ScrollView
          horizontal
          entering={FadeInUp.delay(200)}
          style={styles.previewContainer}
          contentContainerStyle={styles.previewContent}
          showsHorizontalScrollIndicator={false}
        >
          {uris.map(u => (
            <Card key={u} style={styles.previewCard} elevation={4}>
              <Card.Cover source={{ uri: u }} style={styles.previewImage} />
            </Card>
          ))}
        </Animated.ScrollView>
      )}

      {/* Основные кнопки */}
      <View style={styles.actionsContainer}>
        <Button
          mode="contained"
          icon="image-multiple"
          onPress={pickImages}
          buttonColor="#fff"
          textColor="#FF7043"
          style={styles.button}
        >
          Выбрать фото
        </Button>

        <Button
          mode="elevated"
          icon="magnify"
          onPress={handleDetectAll}
          disabled={!uris.length}
          loading={loading}
          style={styles.detectButton}
        >
          Распознать всё
        </Button>
      </View>

      {/* Нижнее меню FAB */}
      <Portal.Host>
        <View style={styles.fabDock}>
          <FAB
            icon="weather-partly-cloudy"
            small
            style={[styles.dockFab, { backgroundColor: '#03A9F4' }]}
            onPress={() => navigation.navigate('Weather')}
          />
          <FAB
            icon="tshirt-crew"
            small
            style={[styles.dockFab, { backgroundColor: '#009688' }]}
            onPress={openSaved}
            loading={syncing}
            disabled={syncing || !saved.length}
          />
          <FAB
            icon="calendar"
            small
            style={[styles.dockFab, { backgroundColor: '#607D8B' }]}
            onPress={() => navigation.navigate('Outfits')}
          />
          <FAB
            icon="logout"
            small
            style={[styles.dockFab, { backgroundColor: '#E53935' }]}
            onPress={() => navigation.navigate('Logout')}
          />
        </View>
      </Portal.Host>

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar(null)}
        duration={4000}
        action={{ label: 'OK', onPress: () => setSnackbar(null) }}
      >
        {snackbar}
      </Snackbar>
    </SafeAreaView>
  );
}

/* ───────── стили ───────── */
const { width } = Dimensions.get('window');
const CARD_SIZE = width * 0.3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerTitle: { color: '#424242', fontWeight: '600' },

  hero: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTitle: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  heroSubtitle: { color: '#FFEDE6' },

  previewContainer: { marginTop: -40, paddingHorizontal: 16 },
  previewContent: { alignItems: 'center' },
  previewCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  previewImage: { width: '100%', height: '100%' },

  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  button: { flex: 1, marginRight: 8, borderRadius: 24 },
  detectButton: { flex: 1, marginLeft: 8, borderRadius: 24 },

  fabDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  dockFab: {
    elevation: 4,
  },
});
