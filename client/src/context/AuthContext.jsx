/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
  const [admin, setAdmin] = useState(() => {
    const raw = localStorage.getItem('adminUser');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem('adminToken', token);
    } else {
      localStorage.removeItem('adminToken');
    }
  }, [token]);

  useEffect(() => {
    if (admin) {
      localStorage.setItem('adminUser', JSON.stringify(admin));
    } else {
      localStorage.removeItem('adminUser');
    }
  }, [admin]);

  const login = (nextToken, nextAdmin) => {
    setToken(nextToken);
    setAdmin(nextAdmin || null);
  };

  const logout = () => {
    setToken('');
    setAdmin(null);
  };

  const value = useMemo(
    () => ({
      token,
      admin,
      isAuthenticated: Boolean(token),
      login,
      logout
    }),
    [token, admin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
