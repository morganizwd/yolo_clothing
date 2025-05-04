import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import ResultScreen from './src/screens/ResultScreen';
import AuthScreen from './src/screens/AuthScreen';
import OutfitsScreen from './src/screens/OutfitsScreen';
import { logout } from './src/api/auth';
import { bootstrapAuthHeader } from './src/api/auth';

const Stack = createStackNavigator();

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapAuthHeader().then(setToken).finally(() => setReady(true));
  }, []);

  if (!ready) return null; /* можно воткнуть Splash */

  return (
    <PaperProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#fafafa' }}>
            {token ? (
              /* ---- авторизованная часть ---- */
              <Stack.Navigator initialRouteName="Home">
                <Stack.Screen
                  name="Home"
                  component={HomeScreen}
                  options={{
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="Result"
                  component={ResultScreen}
                  options={{
                    headerShown: true,
                    headerTitle: 'Детекции и рекомендации',
                    headerBackTitle: 'Назад',
                  }}
                />
                <Stack.Screen
                  name="Logout"
                  component={() => {
                    useEffect(() => {
                      logout().then(() => setToken(null));
                    }, []);
                    return null;
                  }}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="Outfits"
                  component={OutfitsScreen}
                  options={{ headerShown: false }}
                />
              </Stack.Navigator>
            ) : (
              /* ---- стэк авторизации ---- */
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="Auth"
                  children={() => <AuthScreen onAuthSuccess={setToken} />}
                />
              </Stack.Navigator>
            )}
          </SafeAreaView>
        </NavigationContainer>
      </SafeAreaProvider>
    </PaperProvider>
  );
}
