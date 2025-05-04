import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { TextInput, Button, Text, Snackbar, ActivityIndicator } from 'react-native-paper';
import { login, register } from '../api/auth';

interface Props {
    onAuthSuccess: (token: string) => void;
}

export default function AuthScreen({ onAuthSuccess }: Props) {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    const toggleMode = () => setMode(m => (m === 'login' ? 'register' : 'login'));

    const handleSubmit = async () => {
        if (!username || !password) return setMsg('Введите логин и пароль');
        setLoading(true);
        try {
            if (mode === 'register') await register(username, password);
            const token = await login(username, password);
            onAuthSuccess(token);
        } catch (e: any) {
            console.error(e);
            setMsg(e.response?.data?.detail ?? 'Ошибка сети');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.container}>
            <View style={s.card}>
                <Text style={s.title}>{mode === 'login' ? 'Вход' : 'Регистрация'}</Text>

                <TextInput
                    label="Логин"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    style={s.input}
                />
                <TextInput
                    label="Пароль"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={s.input}
                />

                {loading ? (
                    <ActivityIndicator style={{ marginVertical: 16 }} />
                ) : (
                    <Button mode="contained" onPress={handleSubmit} style={{ marginTop: 12 }}>
                        {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                    </Button>
                )}

                <TouchableOpacity onPress={toggleMode}>
                    <Text style={s.switch}>
                        {mode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
                    </Text>
                </TouchableOpacity>
            </View>

            <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={3000}>
                {msg}
            </Snackbar>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
    card: { width: '85%', padding: 24, borderRadius: 12, backgroundColor: '#fff', elevation: 4 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
    input: { marginBottom: 12, backgroundColor: 'transparent' },
    switch: { marginTop: 16, textAlign: 'center', color: '#6200ee' },
});
