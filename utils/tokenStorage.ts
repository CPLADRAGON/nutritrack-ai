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
 * Get a fresh access token from our own backend. The backend holds the Google
 * refresh token in a server-side session, so this is a plain same-origin fetch:
 * no popup, no user gesture, works on page load.
 */
export async function refreshTokenSilently(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/token', { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.access_token) return null;

    storeToken(data.access_token, Number(data.expires_in) || 3600);
    return data.access_token;
  } catch (e) {
    console.warn('Token refresh failed', e);
    return null;
  }
}

/** Clear the local token and end the server-side session. */
export async function logoutSession(): Promise<void> {
  clearStoredToken();
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.warn('Failed to end session', e);
  }
}
