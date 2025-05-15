// src/screens/OutfitsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
  ActivityIndicator,
  Snackbar,
  Text,
} from 'react-native-paper';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import { format } from 'date-fns';

import { listOutfits, deleteOutfit, OutfitDoc } from '../api/outfits';

LocaleConfig.locales.ru = {
  monthNames: [
    'Январь', 'Февраль', 'Март', 'Апрель',
    'Май', 'Июнь', 'Июль', 'Август',
    'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ],
  monthNamesShort: [
    'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
  ],
  dayNames: [
    'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
    'Четверг', 'Пятница', 'Суббота',
  ],
  dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  today: 'Сегодня',
};
LocaleConfig.defaultLocale = 'ru';


export default function OutfitsScreen({ navigation }: any) {
  const [outfits, setOutfits] = useState<OutfitDoc[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  useEffect(() => {
    (async () => {
      try {
        const data = await listOutfits();
        setOutfits(data);
      } catch (err) {
        console.warn(err);
        setSnackbar('Не удалось загрузить');
        setOutfits([]);
      }
    })();
  }, []);

  const outfitsByDate = useMemo(() => {
    if (!outfits) return {};
    return outfits.reduce<Record<string, OutfitDoc[]>>((acc, o) => {
      const d = o.date.split('T')[0]; // iso ⇢ 2025-05-08
      (acc[d] ??= []).push(o);
      return acc;
    }, {});
  }, [outfits]);

  const markedDates = useMemo(() => {
    const result: Record<string, any> = {};
    Object.keys(outfitsByDate).forEach(d => {
      result[d] = {
        marked: true,
        dotColor: '#ff7043',
      };
    });
    if (selectedDate) {
      result[selectedDate] = {
        ...(result[selectedDate] || {}),
        selected: true,
        selectedColor: '#ff7043',
      };
    }
    return result;
  }, [outfitsByDate, selectedDate]);

  const onDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deleteOutfit(id);
      setOutfits(prev => prev!.filter(o => o._id !== id));
      setSnackbar('Удалено');
    } catch (e) {
      console.warn(e);
      setSnackbar('Ошибка удаления');
    } finally {
      setDeleting(null);
    }
  };

  if (!outfits) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Calendar
        markedDates={markedDates}
        onDayPress={(day: DateData) => {
          const d = day.dateString;
          if (outfitsByDate[d]) {
            setSelectedDate(d);
          } else {
            setSelectedDate(null);
          }
        }}
        theme={{
          selectedDayBackgroundColor: '#ff7043',
          todayTextColor: '#ff7043',
          arrowColor: '#ff7043',
        }}
      />

      {selectedDate ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {outfitsByDate[selectedDate].map(o => (
            <Card key={o._id} style={styles.card}>
              <Card.Title
                title={o.name}
                subtitle={format(new Date(o.date), 'dd MMM yyyy')}
                right={(props) => (
                  <IconButton
                    {...props}
                    icon="delete-outline"
                    onPress={() => onDelete(o._id)}
                    loading={deleting === o._id}
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
                    style={styles.preview}
                  />
                ))}
              </ScrollView>
            </Card>
          ))}
          {outfitsByDate[selectedDate].length === 0 && (
            <View style={styles.center}>
              <Text>На этот день луков нет</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={[styles.center, { flex: 1 }]}>
          <Text>Выберите дату с точкой, чтобы увидеть луки</Text>
        </View>
      )}

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar(null)}
        duration={2500}
      >
        {snackbar}
      </Snackbar>
    </View>
  );
}

const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
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