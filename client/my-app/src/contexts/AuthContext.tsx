import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthCtx = {
  token: string | null;
  login: (t: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  token: null,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);

  // поднимаем токен из памяти
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('token');
      if (saved) setToken(saved);
    })();
  }, []);

  const login = async (t: string) => {
    await AsyncStorage.setItem('token', t);
    setToken(t);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
  };

  return <Ctx.Provider value={{ token, login, logout }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
