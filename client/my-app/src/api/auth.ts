// src/api/auth.ts
import http, { bootstrapAuthHeader } from './http';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TokenResponse { access_token: string; token_type: string; }

export async function register(username: string, password: string) {
  await http.post('/auth/register', { username, password });
}

export async function login(username: string, password: string): Promise<string> {
  const { data } = await http.post<TokenResponse>('/auth/login', { username, password });
  await AsyncStorage.setItem('token', data.access_token);
  http.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
  return data.access_token;
}

export { bootstrapAuthHeader };
export async function logout() {
  await AsyncStorage.removeItem('token');
  delete http.defaults.headers.common.Authorization;
}