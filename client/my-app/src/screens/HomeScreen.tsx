// src/screens/HomeScreen.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { listPhotos, SavedPhoto } from '../api/photos';

type SingleResult = { uri: string; detections: DetectionItem[] };

export default function HomeScreen({ navigation }: any) {
  /* ------------------------------------------------------------------ state */
  const [uris, setUris] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  /* ------------------------------------------------------------- nav header */
  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <Appbar.Header>
          <Appbar.Content title="Главная" />
        </Appbar.Header>
      ),
    });
  }, [navigation]);

  /* ------------------------------------------------------------- permissions */
  useEffect(() => {
    (async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setSnackbar('Доступ к галерее не разрешен');
      }
    })();
  }, []);

  /* ------------------------------------ поднимаем сохранённые фото из БД */
  useEffect(() => {
    (async () => {
      setSyncing(true);
      try {
        const photos = await listPhotos();
        setSaved(photos);
      } catch (err: any) {
        console.warn('listPhotos', err);
      } finally {
        setSyncing(false);
      }
    })();
  }, []);

  /* ------------------------------------------------------------------ picks */
  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if ('assets' in result && !result.canceled && result.assets.length > 0) {
        setUris(result.assets.map((a) => a.uri));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      } else if (!('assets' in result) && !result.cancelled) {
        setUris([result.uri]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      }
    } catch (e) {
      console.error(e);
      setSnackbar('Не удалось открыть галерею');
    }
  };

  /* --------------------------------------------------------------- detect  */
  const handleDetectAll = async () => {
    if (!uris.length) return setSnackbar('Выберите хотя бы одно фото');

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

  /* ------------------------------------------------------------ open saved */
  const openSaved = () => {
    if (!saved.length) return;
    const results: SingleResult[] = saved.map((p) => ({
      uri: p.uri_orig,
      detections: p.detections,
    }));
    navigation.navigate('Result', { results });
  };

  /* =================================================================== UI */
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Инструкция */}
      <View style={styles.infoContainer}>
        <Text>Добро пожаловать в демо‑приложение по распознаванию одежды.</Text>
        <Text>
          1. Нажмите «Выбрать фото» и загрузите не&nbsp;менее&nbsp;15
          фотографий элементов гардероба.
        </Text>
        <Text>2. Чем больше фото — тем точнее рекомендации.</Text>
        <Text>3. После загрузки нажмите «Распознать все».</Text>
        <Text>
          4. Результаты могут быть неточными — рассматривайте их как пример.
        </Text>
      </View>

      {/* превью выбранных фото */}
      <ScrollView
        horizontal
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        style={styles.previewContainer}
        contentContainerStyle={styles.previewContent}
      >
        {uris.map((u) => (
          <Card key={u} style={styles.previewCard}>
            <Card.Cover source={{ uri: u }} style={styles.previewImage} />
          </Card>
        ))}
      </ScrollView>

      {/* действия */}
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

      {/* floating buttons */}
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

          {/* открыть сохранённый гардероб */}
          <FAB
            icon="tshirt-crew" // из MaterialCommunityIcons
            style={[
              styles.fab,
              { bottom: 160, backgroundColor: '#009688' },
            ]}
            onPress={openSaved}
            loading={syncing}
            disabled={!saved.length}
          />

          {/* выход */}
          <FAB
            icon="logout"
            style={[
              styles.fab,
              { bottom: 230, backgroundColor: 'red' },
            ]}
            onPress={() => navigation.navigate('Logout')}
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

/* ================================================================== styles */
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
  previewCard: {
    width: 120,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
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
