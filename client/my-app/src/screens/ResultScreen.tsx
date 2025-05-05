// src/screens/ResultScreen.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  LayoutAnimation,
  UIManager,
  Dimensions,
  StatusBar,
  FlatList,
  ScrollView,
} from 'react-native';
import {
  Text,
  Card,
  Searchbar,
  FAB,
  ActivityIndicator,
  Dialog,
  Portal,
  Button,
  TextInput,
  Snackbar,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { AntDesign } from '@expo/vector-icons';

import { recommendOutfits, DetectionItem } from '../api';
import { saveOutfit } from '../api/outfits';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------- types & helpers ---------- */
type SingleResult = { uri: string; detections: DetectionItem[] };
type Rec = { method: string; score: number; items: (DetectionItem & { uri: string })[] };
const makeKey = (d: DetectionItem) => `${d.image_id}-${d.index}`;

/* ---------- constants ---------- */
const clothingOptions = ['hoodie', 'tshirt', 'pants', 'jacket'];
const colorOptions = ['белый', 'чёрный', 'красный', 'лаймовый', 'синий', 'жёлтый', 'циан', 'магента', 'серый', 'зелёный'];

export default function ResultScreen({ route, navigation }: any) {
  const { results } = route.params as { results: SingleResult[] };

  /* ---------- state ---------- */
  const [detectionsByImage, setDetectionsByImage] = useState<SingleResult[]>(() =>
    results.map(r => ({ ...r, detections: [...r.detections] })),
  );
  const [recs, setRecs] = useState<Rec[] | null>(null);

  const [tab, setTab] = useState<'det' | 'rec'>('rec');
  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  /* edit dialog */
  const [editVis, setEditVis] = useState(false);
  const [editImgIdx, setEditImgIdx] = useState(0);
  const [editDetIdx, setEditDetIdx] = useState(0);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  /* save dialog */
  const [saveVis, setSaveVis] = useState(false);
  const [saveRec, setSaveRec] = useState<Rec | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveDate, setSaveDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  /* refs */
  const listRef = useRef<FlatList>(null);

  /* ---------- header ---------- */
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Детекции и рекомендации', headerBackTitle: 'Назад' });
  }, [navigation]);

  /* ---------- make recommendations ---------- */
  const allDet = detectionsByImage.flatMap(im => im.detections.map(d => ({ ...d, uri: im.uri })));

  const buildRecs = async () => {
    try {
      const r = await recommendOutfits(allDet);
      setRecs(r.map(rec => ({
        ...rec,
        items: rec.items.map(it => {
          const src = allDet.find(x => x.image_id === it.image_id && x.index === it.index);
          return { ...it, uri: src?.uri ?? '' };
        }),
      })));
    } catch (e) {
      console.warn(e);
      setRecs([]);
    }
  };
  useEffect(() => { buildRecs(); /* eslint-disable-line */ }, []);

  if (!recs) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12 }}>Генерируем рекомендации…</Text>
      </View>
    );
  }

  /* ---------- search filter ---------- */
  const q = search.trim().toLowerCase();
  const match = (d: DetectionItem) => !q || d.name.toLowerCase().includes(q) ||
    d.color_name?.toLowerCase().includes(q);

  /* detections flattened + index refs */
  const detData = detectionsByImage.flatMap((im, imgIndex) =>
    im.detections.map((d, detIdx) => ({
      ...d,
      uri: im.uri,
      imgIndex,
      detIdx,
    })),
  ).filter(match);

  const recData = recs.map(r => ({
    ...r,
    items: r.items.filter(match),
  })).filter(r => r.items.length);

  /* ---------- edit dialog ---------- */
  const startEdit = (imgIdx: number, detIdx: number) => {
    const det = detectionsByImage[imgIdx].detections[detIdx];
    setEditImgIdx(imgIdx); setEditDetIdx(detIdx);
    setEditName(det.name); setEditColor(det.color_name);
    setEditVis(true);
  };
  const applyEdit = () => {
    setDetectionsByImage(p => {
      const next = [...p];
      next[editImgIdx] = { ...next[editImgIdx], detections: [...next[editImgIdx].detections] };
      next[editImgIdx].detections[editDetIdx].name = editName;
      next[editImgIdx].detections[editDetIdx].color_name = editColor;
      return next;
    });
    setEditVis(false);
    setTimeout(buildRecs, 0);
  };

  /* ---------- save dialog ---------- */
  const startSave = (r: Rec) => {
    setSaveRec(r);
    setSaveName(r.method);
    setSaveDate(new Date());
    setSaveVis(true);
  };
  const doSave = async () => {
    if (!saveRec) return;
    try {
      setSaving(true);
      await saveOutfit({
        name: saveName || saveRec.method,
        date: saveDate.toISOString(),
        items: saveRec.items,
        photo_uris: saveRec.items.map(i => i.uri),
      });
      setSaveVis(false);
      setSnack('Сохранено');
    } catch {
      setSnack('Ошибка');
    } finally { setSaving(false); }
  };

  /* --- grid calc --- */
  const GAP = 12, COLS = 2;
  const ITEM_W = (Dimensions.get('window').width - GAP * (COLS + 1)) / COLS;

  /* =============== RENDER =============== */
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <Searchbar
        placeholder="Поиск"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        {['det', 'rec'].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t as 'det' | 'rec')}
          >
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
              {t === 'det' ? 'Детекции' : 'Рекомендации'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONTENT */}
      {tab === 'det' ? (
        <FlatList
          ref={listRef}
          key="det"
          data={detData}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ padding: GAP, paddingBottom: 100 }}
          keyExtractor={makeKey}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => startEdit(item.imgIndex, item.detIdx)}>
              <Card style={[styles.detCard, { width: ITEM_W }]}>
                <Image source={{ uri: item.uri }} style={styles.detImg} />
                <View style={styles.detInfo}>
                  <Text numberOfLines={1} style={styles.detName}>{item.name}</Text>
                  <Text numberOfLines={1} style={styles.detColor}>{item.color_name}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          ref={listRef}
          key="rec"
          data={recData}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          keyExtractor={r => r.method}
          renderItem={({ item }) => (
            <Card style={styles.recCard}>
              <View style={styles.recHeader}>
                <View style={[
                  styles.scoreBadge,
                  { backgroundColor: item.score >= 8 ? '#4caf50' : item.score >= 5 ? '#ff9800' : '#f44336' }
                ]}>
                  <Text style={styles.scoreTxt}>{item.score.toFixed(1)}</Text>
                </View>
                <Text style={styles.recTitle}>{item.method}</Text>
                <Button icon="content-save-outline" compact onPress={() => startSave(item)} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                {item.items.map(it => (
                  <View key={makeKey(it)} style={{ alignItems: 'center', marginRight: 12 }}>
                    <Image source={{ uri: it.uri }} style={styles.recImg} />
                    <Text style={styles.recImgTxt} numberOfLines={1}>{it.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </Card>
          )}
        />
      )}

      {/* FAB up */}
      <FAB
        icon="arrow-up"
        small
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        style={styles.fab}
      />

      {/* -------- dialogs -------- */}
      <Portal>
        {/* edit */}
        <Dialog visible={editVis} onDismiss={() => setEditVis(false)}>
          <Dialog.Title>Редактировать</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.label}>Класс</Text>
            <Picker selectedValue={editName} onValueChange={setEditName} style={styles.picker}>
              {clothingOptions.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
            <Text style={styles.label}>Цвет</Text>
            <Picker selectedValue={editColor} onValueChange={setEditColor} style={styles.picker}>
              {colorOptions.map(c => <Picker.Item key={c} label={c} value={c} />)}
            </Picker>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditVis(false)}>Отмена</Button>
            <Button onPress={applyEdit}>OK</Button>
          </Dialog.Actions>
        </Dialog>

        {/* save */}
        <Dialog visible={saveVis} onDismiss={() => setSaveVis(false)}>
          <Dialog.Title>Сохранить лук</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Название" mode="outlined" value={saveName} onChangeText={setSaveName} style={{ marginBottom: 12 }} />
            <Text style={styles.label}>Дата</Text>
            <DateTimePicker value={saveDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, d) => d && setSaveDate(d)} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSaveVis(false)}>Отмена</Button>
            <Button onPress={doSave} loading={saving} disabled={saving}>Сохранить</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>{snack}</Snackbar>
    </View>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fafafa' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  search: { margin: 12, borderRadius: 24 },
  tabs: { flexDirection: 'row', marginHorizontal: 12, borderRadius: 24, overflow: 'hidden', backgroundColor: '#e0e0e0' },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabTxt: { fontSize: 16, color: '#555' }, tabTxtActive: { color: '#000', fontWeight: '600' },

  detCard: { borderRadius: 12, overflow: 'hidden', marginBottom: 12, elevation: 2 },
  detImg: { width: '100%', height: 140 },
  detInfo: { padding: 8 },
  detName: { fontWeight: '600', marginBottom: 2 },
  detColor: { color: '#666' },

  recCard: { borderRadius: 14, marginBottom: 12, elevation: 2 },
  recHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f5f5f5' },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
  scoreTxt: { color: '#fff', fontWeight: '600' },
  recTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  recImg: { width: 90, height: 90, borderRadius: 8, backgroundColor: '#ccc' },
  recImgTxt: { width: 90, textAlign: 'center', fontSize: 12, marginTop: 4 },

  label: { marginTop: 6, marginBottom: 4, color: '#555' },
  picker: { backgroundColor: '#f2f2f2', borderRadius: 6 },

  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: '#6200ee' },
});
