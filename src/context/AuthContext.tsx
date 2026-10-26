"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const login = (newAccessToken: string, newRefreshToken: string, newUser: CustomerUser) => {
    localStorage.setItem('aslikaata_customer_access_token', newAccessToken);
    localStorage.setItem('aslikaata_customer_refresh_token', newRefreshToken);
    localStorage.setItem('aslikaata_customer_profile', JSON.stringify(newUser));
    setAccessToken(newAccessToken);
    setUser(newUser);
  };

  const updateUser = (partial: Partial<CustomerUser>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    localStorage.setItem('aslikaata_customer_profile', JSON.stringify(updated));
    setUser(updated);
  };

  const logout = () => {
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
