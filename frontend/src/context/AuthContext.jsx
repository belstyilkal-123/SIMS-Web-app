import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef       = useRef(null);

  // ── Schedule silent token refresh before expiry ───────────────────────────
  // Access token is 8h in dev / 15m in production. Refresh 60s before expiry.
  const scheduleRefresh = useCallback((token) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    try {
      const [, payload] = token.split('.');
      const { exp } = JSON.parse(atob(payload));
      const msUntilExpiry = exp * 1000 - Date.now() - 60_000; // 60s buffer
      if (msUntilExpiry <= 0) return; // already expired

      refreshTimerRef.current = setTimeout(async () => {
        try {
          const res = await axios.post(
            `${API_URL}/api/auth/refresh`,
            {},
            { withCredentials: true }
          );
          const newToken = res.data.token;
          setUser(prev => {
            if (!prev) return prev;
            const updated = { ...prev, token: newToken };
            localStorage.setItem('userInfo', JSON.stringify(updated));
            return updated;
          });
          scheduleRefresh(newToken);
        } catch {
          // Refresh token expired — force logout
          logout();
        }
      }, msUntilExpiry);
    } catch {
      // Token decode failed — ignore
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      scheduleRefresh(parsed.token);
    }
    setLoading(false);
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true }  // needed to receive httpOnly refresh cookie
      );
      const userData = response.data;
      setUser(userData);
      localStorage.setItem('userInfo', JSON.stringify(userData));
      if (userData.language) {
        localStorage.setItem('preferredLanguage', userData.language);
      }
      scheduleRefresh(userData.token);
      return { success: true, role: userData.role };
    } catch (error) {
      const preferredLang = localStorage.getItem('preferredLanguage') || 'en';
      const rawError = error.response?.data;
      const msg = (preferredLang === 'am' && rawError?.error_am)
        ? rawError.error_am
        : rawError?.error || 'Login failed';
      return { success: false, error: msg };
    }
  };

  const register = async (name, email, password, role) => {
    try {
      await axios.post(`${API_URL}/api/auth/register`, { name, email, password, role });
      return { success: true };
    } catch (error) {
      const preferredLang = localStorage.getItem('preferredLanguage') || 'en';
      const rawError = error.response?.data;
      const msg = (preferredLang === 'am' && rawError?.error_am)
        ? rawError.error_am
        : rawError?.error || 'Registration failed';
      return { success: false, error: msg };
    }
  };

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      // Revoke refresh token server-side
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    localStorage.removeItem('userInfo');
  }, []);

  const updateProfile = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem('userInfo', JSON.stringify(updatedUserData));
    if (updatedUserData.token) scheduleRefresh(updatedUserData.token);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
