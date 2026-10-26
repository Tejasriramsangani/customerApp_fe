/**
 * ASLI KAATA API Client
 * Configured with automatic JWT Bearer injection, 401 refresh token rotation,
 * and real-time backend server health & downtime detection.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: { message?: string | string[] } | string | null;
  timestamp: string;
}

export const getApiErrorMessage = (error: unknown, fallback = 'Request failed'): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (Array.isArray(message)) return message.map(String).join(', ');
    if (message != null) return String(message);
  }
  return fallback;
};

export const normalizeMobile = (mobile: string) => mobile.replace(/\D/g, '').slice(-10);

type ServerStatusListener = (isDown: boolean, details?: string) => void;

class ApiClient {
  private statusListeners: Set<ServerStatusListener> = new Set();
  public isServerDown: boolean = false;
  public lastErrorDetails: string = '';

  public onServerStatusChange(listener: ServerStatusListener) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatus(isDown: boolean, details?: string) {
    this.isServerDown = isDown;
    if (details) this.lastErrorDetails = details;
    this.statusListeners.forEach((fn) => fn(isDown, details));
  }

  public async checkHealth(): Promise<boolean> {
    const rootUrl = BASE_URL.replace(/\/api\/v1\/?$/, '');
    try {
      const res = await fetch(`${rootUrl}/health`, { method: 'GET', cache: 'no-store' });
      if (res.ok) {
        this.notifyStatus(false);
        return true;
      }
    } catch {}
    try {
      const catalog = await fetch(`${BASE_URL}/catalog`, { method: 'GET', cache: 'no-store' });
      if (catalog.ok) {
        this.notifyStatus(false);
        return true;
      }
    } catch {
      // Both probes failed.
    }
    this.notifyStatus(true, 'Server unreachable or undergoing maintenance');
    return false;
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('aslikaata_customer_access_token');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('aslikaata_customer_refresh_token');
  }

  private setTokens(accessToken: string, refreshToken?: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('aslikaata_customer_access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('aslikaata_customer_refresh_token', refreshToken);
    }
  }

  public clearTokens() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('aslikaata_customer_access_token');
    localStorage.removeItem('aslikaata_customer_refresh_token');
    localStorage.removeItem('aslikaata_customer_profile');
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        this.clearTokens();
        return null;
      }

      const json: ApiResponse<{ accessToken: string; refreshToken?: string }> = await res.json();
      if (json.success && json.data.accessToken) {
        this.setTokens(json.data.accessToken, json.data.refreshToken);
        return json.data.accessToken;
      }
    } catch {
      this.clearTokens();
    }
    return null;
  }

  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, { ...options, headers });

      // Handle 502, 503, 504 server down / maintenance errors
      if (response.status >= 502 && response.status <= 504) {
        this.notifyStatus(true, `HTTP ${response.status}: Gateway or Service Maintenance`);
      } else if (this.isServerDown && response.status < 500) {
        this.notifyStatus(false);
      }

      // Handle 401 Unauthorized with token refresh rotation
      if (response.status === 401 && !isRetry) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          headers.set('Authorization', `Bearer ${newToken}`);
          return this.request<T>(endpoint, { ...options, headers }, true);
        }
      } else if (response.status === 401) {
        this.clearTokens();
      }

      try {
        const data = (await response.json()) as ApiResponse<T>;
        if (!response.ok && data.success) data.success = false;
        return data;
      } catch {
        return {
          success: false,
          data: null as T,
          error: { message: `HTTP ${response.status}` },
          timestamp: new Date().toISOString(),
        };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network request failed';
      // Flag server downtime on connection refusals or network failures
      if (
        errorMsg.includes('Failed to fetch') ||
        errorMsg.includes('NetworkError') ||
        errorMsg.includes('fetch failed') ||
        errorMsg.includes('Network request failed')
      ) {
        this.notifyStatus(true, errorMsg);
      }

      return {
        success: false,
        data: null as any,
        error: { message: errorMsg },
        timestamp: new Date().toISOString(),
      };
    }
  }

  public get<T = any>(endpoint: string, headers?: HeadersInit) {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  public post<T = any>(endpoint: string, body?: any, headers?: HeadersInit) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers,
    });
  }

  public put<T = any>(endpoint: string, body?: any, headers?: HeadersInit) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers,
    });
  }

  public patch<T = any>(endpoint: string, body?: any, headers?: HeadersInit) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers,
    });
  }

  public delete<T = any>(endpoint: string, headers?: HeadersInit) {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  public getMe<T = any>() { return this.get<T>('/auth/me'); }
  public getProfile<T = any>() { return this.get<T>('/customer/profile'); }
  public getAvailability<T = any>(addressId: string, weightRangeId: string) {
    return this.get<T>(`/availability?addressId=${encodeURIComponent(addressId)}&weightRangeId=${encodeURIComponent(weightRangeId)}`);
  }
  public getQr<T = any>(id: string) { return this.get<T>(`/customer/pickups/${id}/qr`); }
  public getSummary<T = any>(id: string) { return this.get<T>(`/customer/pickups/${id}/summary`); }
  public approveSummary<T = any>(id: string, summaryHash: string) {
    return this.post<T>(`/customer/pickups/${id}/approve`, { summaryHash });
  }
  public resendClosingOtp<T = any>(id: string) {
    return this.post<T>(`/customer/pickups/${id}/resend-closing-otp`);
  }
  public getDonationRecipients<T = any>() { return this.get<T>('/catalog/donation-recipients'); }
}

export const apiClient = new ApiClient();
