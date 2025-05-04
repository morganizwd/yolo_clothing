import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Appbar, Button, Card, FAB, Snackbar, Text, Portal } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { detectImage, DetectionItem } from '../api';
import { listPhotos, SavedPhoto } from '../api/photos';

type SingleResult = { uri: string; detections: DetectionItem[] };

export default function HomeScreen({ navigation }: any) {
  const [uris, setUris] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <Appbar.Header elevated style={{ backgroundColor: '#ffffff' }}>
          <Appbar.Content title="Главная" titleStyle={styles.headerTitle} />
        </Appbar.Header>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') setSnackbar('Доступ к галерее не разрешен');
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setSyncing(true);
      try {
        const photos = await listPhotos();
        setSaved(photos);
      } catch (err) {
        console.warn(err);
      } finally {
        setSyncing(false);
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

      if (!result.cancelled) {
        const assets = ('assets' in result ? result.assets : [result]).map(a => a.uri);
        setUris(assets);
      }
    } catch {
      setSnackbar('Не удалось открыть галерею');
    }
  };

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
      setSnackbar(e.message || 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  };

  const openSaved = () => {
    if (saved.length === 0) return;
    const results = saved.map(p => ({ uri: p.uri_orig, detections: p.detections }));
    navigation.navigate('Result', { results });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <LinearGradient
        colors={["#FF8A65", "#FF7043"]}
        style={styles.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View entering={FadeInUp.delay(100)}>
          <Text variant="headlineMedium" style={styles.heroTitle}>
            Распознавание гардероба
          </Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Загрузите фото своих вещей, и мы подскажем идеи образов!
          </Text>
        </Animated.View>
      </LinearGradient>

      {uris.length > 0 && (
        <Animated.ScrollView
          horizontal
          style={styles.previewContainer}
          contentContainerStyle={styles.previewContent}
          showsHorizontalScrollIndicator={false}
          entering={FadeInUp.delay(200)}
        >
          {uris.map(uri => (
            <Card key={uri} style={styles.previewCard} elevation={4}>
              <Card.Cover source={{ uri }} style={styles.previewImage} />
            </Card>
          ))}
        </Animated.ScrollView>
      )}

      <View style={styles.actionsContainer}>
        <Button
          mode="contained"
          icon="image-multiple"
          onPress={pickImages}
          buttonColor="#FFFFFF"
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
          Распознать все
        </Button>
      </View>

      <Portal.Host>
        <Portal>
          <FAB
            icon="trash-can-outline"
            style={[styles.fab, { bottom: 100 }]}
            onPress={() => setUris([])}
            disabled={uris.length === 0}
          />

          <FAB
            icon="tshirt-crew"
            style={[styles.fab, { bottom: 180, backgroundColor: '#009688' }]}
            onPress={openSaved}
            loading={syncing}
            disabled={saved.length === 0}
          />

          <FAB
            icon="calendar"
            small
            style={[styles.fab, { bottom: 260, backgroundColor: '#607D8B' }]}
            onPress={() => navigation.navigate('Outfits')}
          />

          <FAB
            icon="logout"
            small
            style={[styles.fab, { bottom: 340, backgroundColor: '#E53935' }]}
            onPress={() => navigation.navigate('Logout')}
          />
        </Portal>
      </Portal.Host>

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar(null)}
        action={{ label: 'OK', onPress: () => setSnackbar(null) }}
        duration={4000}
      >
        {snackbar}
      </Snackbar>
    </SafeAreaView>
  );
}

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
  heroTitle: { color: '#FFFFFF', fontWeight: '700', marginBottom: 8 },
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
  button: {
    flex: 1,
    marginRight: 8,
    borderRadius: 24,
  },
  detectButton: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
  },
});
