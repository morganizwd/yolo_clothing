// src/screens/ResultScreen.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
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
  IconButton,
  TextInput,
  Snackbar,
  Button
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';

import { recommendOutfits, DetectionItem } from '../api';
import { saveOutfit } from '../api/outfits';
import { deletePhoto } from '../api/photos';
import { updateDetections } from '../api/photos';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SingleResult = {
  _id?: string;
  uri: string;
  detections: DetectionItem[];
};
type Rec = {
  method: string;
  score: number;
  items: (DetectionItem & { uri: string })[];
};
const keyDet = (d: DetectionItem) => `${d.image_id}-${d.index}`;

const clothes = ['hoodie', 'tshirt', 'pants', 'jacket'];
const colors = [
  'белый', 'чёрный', 'красный', 'лаймовый', 'синий', 'жёлтый',
  'циан', 'магента', 'серый', 'зелёный',
];

export default function ResultScreen({ route, navigation }: any) {
  const { results } = route.params as { results: SingleResult[] };

  const [images, setImages] = useState<SingleResult[]>(() =>
    results.map(r => ({ ...r, detections: [...r.detections] }))
  );
  const [recs, setRecs] = useState<Rec[] | null>(null);

  const [tab, setTab] = useState<'det' | 'rec'>('rec');
  const [query, setQuery] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const [editVis, setEditVis] = useState(false);
  const [eImg, setEImg] = useState(0);
  const [eDet, setEDet] = useState(0);
  const [eName, setEName] = useState('');
  const [eColor, setEColor] = useState('');

  const [saveVis, setSaveVis] = useState(false);
  const [saveRec, setSaveRec] = useState<Rec | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveDate, setSaveDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const listRef = useRef<FlatList>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Детекции и рекомендации',
      headerBackTitle: 'Назад',
    });
  }, [navigation]);

  useEffect(() => {
    const allDet = images.flatMap(im =>
      im.detections.map(d => ({ ...d, uri: im.uri }))
    );
    if (allDet.length === 0) {
      setRecs([]);
      return;
    }
    (async () => {
      try {
        const r = await recommendOutfits(allDet);
        setRecs(
          r.map(rec => ({
            ...rec,
            items: rec.items.map(it => {
              const src = allDet.find(
                x => x.image_id === it.image_id && x.index === it.index
              );
              return { ...it, uri: src?.uri ?? '' };
            }),
          }))
        );
      } catch (err) {
        console.warn(err);
        setRecs([]);
      }
    })();
  }, [images]);

  if (recs === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12 }}>Генерируем…</Text>
      </View>
    );
  }

  const q = query.trim().toLowerCase();
  const match = (d: DetectionItem) =>
    !q ||
    d.name.toLowerCase().includes(q) ||
    d.color_name?.toLowerCase().includes(q);

  const detData = images
    .flatMap((im, imgIdx) =>
      im.detections.map((d, detIdx) => ({
        ...d,
        uri: im.uri,
        imgIdx,
        detIdx,
      }))
    )
    .filter(match);

  const recData = recs
    .map(r => ({ ...r, items: r.items.filter(match) }))
    .filter(r => r.items.length);

  const openEdit = (imgIdx: number, detIdx: number) => {
    const d = images[imgIdx].detections[detIdx];
    setEImg(imgIdx);
    setEDet(detIdx);
    setEName(d.name);
    setEColor(d.color_name);
    setEditVis(true);
  };
  const applyEdit = async () => {
    const newImages = images.map((img, idx) => {
      if (idx !== eImg) return img;
      const newDets = img.detections.map((d, j) =>
        j === eDet
          ? { ...d, name: eName, color_name: eColor }
          : d
      );
      return { ...img, detections: newDets };
    });

    setImages(newImages);
    setEditVis(false);

    const photo = newImages[eImg];
    if (photo._id) {
      try {
        await updateDetections(photo._id, photo.detections);
        setSnack('Изменения сохранены');
      } catch (err) {
        console.warn('updateDetections', err);
        setSnack('Ошибка сохранения');
      }
    }
  };

  const deleteDet = (imgIdx: number, detIdx: number) => {
    setImages(prev => {
      const nxt = [...prev];
      const snap = nxt[imgIdx];
      const newDet = [...snap.detections];
      newDet.splice(detIdx, 1);

      if (newDet.length === 0) {
        if (snap._id) {
          Alert.alert(
            'Удалить фото?',
            'Фото будет удалено и на сервере.',
            [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Удалить',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deletePhoto(snap._id!);
                    setSnack('Фото удалено');
                  } catch {
                    setSnack('Ошибка удаления');
                  }
                  setImages(cur => {
                    const arr = [...cur];
                    arr.splice(imgIdx, 1);
                    return arr;
                  });
                },
              },
            ]
          );
        } else {
          nxt.splice(imgIdx, 1);
        }
      } else {
        nxt[imgIdx] = { ...snap, detections: newDet };
      }
      return nxt;
    });
  };

  const deleteAll = () => {
    if (!images.length) return setSnack('Нечего удалять');
    Alert.alert(
      'Удалить все?',
      'Все детекции и фото будут удалены, включая серверные файлы.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё',
          style: 'destructive',
          onPress: async () => {
            for (const snap of images) {
              if (snap._id) {
                try { await deletePhoto(snap._id); }
                catch { }
              }
            }
            setImages([]);
            setSnack('Все удалено');
          },
        },
      ]
    );
  };

  const openSave = (r: Rec) => {
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
    } finally {
      setSaving(false);
    }
  };

  const GAP = 12,
    COLS = 2;
  const ITEM_W =
    (Dimensions.get('window').width - GAP * (COLS + 1)) / COLS;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <Searchbar
        placeholder="Поиск"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />

      <View style={styles.tabs}>
        {(['det', 'rec'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tab,
              tab === t && styles.tabActive,
            ]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[
                styles.tabTxt,
                tab === t && styles.tabTxtActive,
              ]}
            >
              {t === 'det' ? 'Детекции' : 'Рекомендации'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'det' ? (
        <FlatList
          ref={listRef}
          data={detData}
          key="det"
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{
            padding: GAP,
            paddingBottom: 100,
          }}
          keyExtractor={keyDet}
          renderItem={({ item }) => (
            <Card
              style={[
                styles.detCard,
                { width: ITEM_W },
              ]}
            >
              <TouchableOpacity
                onPress={() =>
                  openEdit(item.imgIdx, item.detIdx)
                }
              >
                <Image
                  source={{ uri: item.uri }}
                  style={styles.detImg}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.delBtn}
                onPress={() =>
                  deleteDet(item.imgIdx, item.detIdx)
                }
              >
                <MaterialIcons
                  name="delete"
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
              <View style={styles.detInfo}>
                <Text
                  numberOfLines={1}
                  style={styles.detName}
                >
                  {item.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={styles.detColor}
                >
                  {item.color_name}
                </Text>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={recData}
          key="rec"
          contentContainerStyle={{
            padding: 12,
            paddingBottom: 100,
          }}
          keyExtractor={r => r.method}
          renderItem={({ item }) => (
            <Card style={styles.recCard}>
              <View style={styles.recHeader}>
                <Text style={styles.recTitle}>
                  {item.method}
                </Text>
                <IconButton
                  icon="content-save-outline"
                  size={24}
                  onPress={() => openSave(item)}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={{
                  paddingHorizontal: 12,
                  paddingBottom: 12,
                }}
              >
                {item.items.map(it => (
                  <View
                    key={keyDet(it)}
                    style={{
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Image
                      source={{ uri: it.uri }}
                      style={styles.recImg}
                    />
                    <Text
                      style={styles.recImgTxt}
                      numberOfLines={1}
                    >
                      {it.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Card>
          )}
        />
      )}

      <FAB
        icon="arrow-up"
        small
        onPress={() =>
          listRef.current?.scrollToOffset({
            offset: 0,
            animated: true,
          })
        }
        style={styles.fab}
      />

      <FAB
        icon="delete-sweep"
        small
        onPress={deleteAll}
        style={[styles.fab, { right: 80 }]}
      />

      <Portal>
        <Dialog
          visible={editVis}
          onDismiss={() => setEditVis(false)}
        >
          <Dialog.Title>Редактировать</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.label}>Класс</Text>
            <Picker
              selectedValue={eName}
              onValueChange={setEName}
              style={styles.picker}
            >
              {clothes.map(c => (
                <Picker.Item
                  key={c}
                  label={c}
                  value={c}
                />
              ))}
            </Picker>
            <Text style={styles.label}>Цвет</Text>
            <Picker
              selectedValue={eColor}
              onValueChange={setEColor}
              style={styles.picker}
            >
              {colors.map(c => (
                <Picker.Item
                  key={c}
                  label={c}
                  value={c}
                />
              ))}
            </Picker>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditVis(false)}>Отмена</Button>
            <Button onPress={applyEdit}>OK</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={saveVis}
          onDismiss={() => setSaveVis(false)}
        >
          <Dialog.Title>Сохранить лук</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Название"
              mode="outlined"
              value={saveName}
              onChangeText={setSaveName}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.label}>Дата</Text>
            <DateTimePicker
              value={saveDate}
              mode="date"
              display={
                Platform.OS === 'ios'
                  ? 'spinner'
                  : 'default'
              }
              onChange={(_, d) => d && setSaveDate(d)}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSaveVis(false)}>
              Отмена
            </Button>
            <Button
              onPress={doSave}
              loading={saving}
              disabled={saving}
            >
              Сохранить
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={2500}
      >
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fafafa' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { margin: 12, borderRadius: 24 },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 12,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabTxt: { fontSize: 16, color: '#555' },
  tabTxtActive: { color: '#000', fontWeight: '600' },

  detCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 2,
  },
  detImg: { width: '100%', height: 140 },
  detInfo: { padding: 8 },
  detName: { fontWeight: '600', marginBottom: 2 },
  detColor: { color: '#666' },
  delBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 4,
  },

  recCard: {
    borderRadius: 14,
    marginBottom: 12,
    elevation: 2,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  scoreTxt: { color: '#fff', fontWeight: '600' },
  recTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  recImg: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  recImgTxt: {
    width: 90,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },

  label: { marginTop: 6, marginBottom: 4, color: '#555' },
  picker: { backgroundColor: '#f2f2f2', borderRadius: 6 },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#6200ee',
  },
});
