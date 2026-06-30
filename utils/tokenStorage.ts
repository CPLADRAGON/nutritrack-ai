import { GOOGLE_CLIENT_ID } from '../config';

const STORAGE_KEY = 'nutritrack_google_token';

interface StoredToken {
  access_token: string;
  expires_at: number; // epoch ms
}

export function storeToken(accessToken: string, expiresIn: number): void {
  const token: StoredToken = {
    access_token: accessToken,
    expires_at: Date.now() + expiresIn * 1000,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  } catch (e) {
    console.warn('Failed to store token', e);
  }
}

export function getStoredToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const token: StoredToken = JSON.parse(raw);
    if (token?.access_token && typeof token.expires_at === 'number') {
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

/** Token is valid for at least the next 30 seconds (avoids race conditions). */
export function isTokenValid(): boolean {
  const token = getStoredToken();
  if (!token) return false;
  return token.expires_at > Date.now() + 30_000;
}

/** Token is expiring within the given window (ms) and should be refreshed. */
export function isTokenExpiringSoon(windowMs = 5 * 60_000): boolean {
  const token = getStoredToken();
  if (!token) return true;
  return token.expires_at <= Date.now() + windowMs;
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear token', e);
  }
}

/**
 * Attempt silent OAuth token refresh via GIS.
 * Returns the new access token or null if the silent refresh failed.
 */
export function refreshTokenSilently(): Promise<string | null> {
  return new Promise((resolve) => {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2 || !GOOGLE_CLIENT_ID) {
      resolve(null);
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.access_token) {
            storeToken(response.access_token, response.expires_in);
            resolve(response.access_token);
          } else {
            resolve(null);
          }
        },
        error_callback: () => resolve(null),
      });

      client.requestAccessToken({ prompt: 'none' });
    } catch {
      resolve(null);
    }
  });
}
