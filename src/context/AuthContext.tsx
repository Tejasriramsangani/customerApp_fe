"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import { enablePush, disablePush } from '../lib/push';

export interface CustomerUser {
  id: string;
  mobile: string;
  fullName?: string;
  roles?: string[];
  status?: string;
  avatarUrl?: string;
  defaultAddressId?: string;
}

interface AuthContextType {
  user: CustomerUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, user: CustomerUser) => void;
  updateUser: (partial: Partial<CustomerUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, previewUser }: { children: React.ReactNode; previewUser?: CustomerUser }) {
  const isPreview = !!previewUser && apiClient.isUiPreview();
  const [user, setUser] = useState<CustomerUser | null>(isPreview ? previewUser! : null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isPreview);

  useEffect(() => {
    if (isPreview) return;
    let mounted = true;
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('aslikaata_customer_access_token');
      const storedUser = localStorage.getItem('aslikaata_customer_profile');
      if (!storedToken) {
        if (mounted) setIsLoading(false);
        return;
      }
      const [meRes, profileRes] = await Promise.all([
        apiClient.getMe<any>(),
        apiClient.getProfile<any>(),
      ]);
      if (!meRes.success) {
        apiClient.clearTokens();
      } else if (mounted) {
        const cached = storedUser ? JSON.parse(storedUser) : {};
        const hydrated: CustomerUser = {
          ...cached,
          id: meRes.data.id,
          mobile: meRes.data.mobile,
          roles: meRes.data.roles,
          status: meRes.data.status,
          fullName: profileRes.success ? profileRes.data?.fullName : cached.fullName,
        };
        localStorage.setItem('aslikaata_customer_profile', JSON.stringify(hydrated));
        setAccessToken(storedToken);
        setUser(hydrated);
      }
      if (mounted) setIsLoading(false);
    };
    restoreSession().catch(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, [isPreview]);

  // Register this phone for push once the user is signed in (restored session or fresh login).
  // No-op in a normal browser.
  useEffect(() => {
    if (!user?.id || !accessToken) return;
    void enablePush((token, platform) => apiClient.post('/devices', { token, platform }));
  }, [user?.id, accessToken]);

  const login = (newAccessToken: string, newRefreshToken: string, newUser: CustomerUser) => {
    if (isPreview) throw new Error('UI preview does not authenticate customers.');
    localStorage.setItem('aslikaata_customer_access_token', newAccessToken);
    localStorage.setItem('aslikaata_customer_refresh_token', newRefreshToken);
    localStorage.setItem('aslikaata_customer_profile', JSON.stringify(newUser));
    setAccessToken(newAccessToken);
    setUser(newUser);
  };

  const updateUser = (partial: Partial<CustomerUser>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    if (!isPreview) localStorage.setItem('aslikaata_customer_profile', JSON.stringify(updated));
    setUser(updated);
  };

  const logout = () => {
    if (isPreview) { setUser(null); return; }
    // Must run before clearTokens(): the request needs the access token.
    disablePush((token) => apiClient.request('/devices', { method: 'DELETE', body: JSON.stringify({ token }) }));
    void apiClient.post('/auth/logout');
    apiClient.clearTokens();
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
