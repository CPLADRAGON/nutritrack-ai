import { SESSION_COOKIE, isConfigured, json, readCookie } from './_shared.js';

// Exchanges the stored refresh token for a fresh 1-hour access token.
// Called by the app on page load and whenever its token is about to expire.
export const onRequestGet = async ({ request, env }) => {
  if (!isConfigured(env)) return json({ error: 'server_misconfigured' }, 500);

  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return json({ error: 'not_authenticated' }, 401);

  const key = `session:${sessionId}`;
  const stored = await env.SESSIONS.get(key);
  if (!stored) return json({ error: 'not_authenticated' }, 401);

  let session;
  try {
    session = JSON.parse(stored);
  } catch {
    return json({ error: 'not_authenticated' }, 401);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: session.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (body.error === 'invalid_grant') {
      // Revoked or expired — drop the session so the app shows the sign-in screen.
      await env.SESSIONS.delete(key);
      return json({ error: 'not_authenticated' }, 401);
    }
    return json({ error: 'token_refresh_failed' }, 502);
  }

  const tokens = await response.json();

  // Google normally returns the same refresh token; keep the newest if it rotates.
  if (tokens.refresh_token && tokens.refresh_token !== session.refresh_token) {
    session.refresh_token = tokens.refresh_token;
    await env.SESSIONS.put(key, JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 180 });
  }

  return json({ access_token: tokens.access_token, expires_in: tokens.expires_in });
};
