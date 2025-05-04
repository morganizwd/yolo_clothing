// src/api/http.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const http = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

// После входа (или при старте), чтобы установить заголовок во все последующие запросы:
export async function bootstrapAuthHeader() {
    const token = await AsyncStorage.getItem('token');
    if (token) {
        http.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    return token;
}

export default http;
