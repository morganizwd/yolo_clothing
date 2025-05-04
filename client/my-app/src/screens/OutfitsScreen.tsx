//screens/
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import {
  Appbar,
  Card,
  IconButton,
  Text,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { format } from 'date-fns';
import { listOutfits, deleteOutfit, OutfitDoc } from '../api/outfits';

export default function OutfitsScreen({ navigation }: any) {
  const [outfits, setOutfits] = useState<OutfitDoc[] | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  /* header */
  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Мои луки" />
        </Appbar.Header>
      ),
    });
  }, [navigation]);

  /* load */
  const load = async () => {
    try {
      const data = await listOutfits();
      setOutfits(data);
    } catch (e) {
      console.warn(e);
      setSnackbar('Не удалось загрузить');
      setOutfits([]);
    }
  };
  useEffect(() => {
    load();
  }, []);

  /* delete */
  const onDelete = async (id: string) => {
    try {
      await deleteOutfit(id);
      setOutfits(p => p!.filter(o => o._id !== id));
      setSnackbar('Удалено');
    } catch (e) {
      setSnackbar('Ошибка удаления');
    }
  };

  /* loading */
  if (!outfits) {
    return (
      <View style={s.center}>
        <ActivityIndicator animating />
      </View>
    );
  }

  /* empty */
  if (outfits.length === 0) {
    return (
      <View style={s.center}>
        <Text>Нет сохранённых луков 😔</Text>
      </View>
    );
  }

  /* render */
  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {outfits.map(o => (
        <Card key={o._id} style={s.card}>
          <Card.Title
            title={o.name}
            subtitle={format(new Date(o.date), 'dd MMM yyyy')}
            right={props => (
              <IconButton
                {...props}
                icon="delete-outline"
                onPress={() => onDelete(o._id)}
              />
            )}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ paddingVertical: 8 }}
          >
            {o.photo_uris.map(uri => (
              <Image
                key={uri}
                source={{ uri }}
                style={s.preview}
              />
            ))}
          </ScrollView>
        </Card>
      ))}

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar(null)}
        duration={2500}
      >
        {snackbar}
      </Snackbar>
    </ScrollView>
  );
}

/* styles */
const { width } = Dimensions.get('window');
const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 12 },
  card: { marginBottom: 12, borderRadius: 12 },
  preview: {
    width: width / 3,
    height: width / 3,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
});
