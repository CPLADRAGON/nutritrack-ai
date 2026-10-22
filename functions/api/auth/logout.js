import { SESSION_COOKIE, cookie, isConfigured, readCookie } from './_shared.js';

export const onRequestPost = async ({ request, env }) => {
  if (!isConfigured(env)) return new Response(null, { status: 204 });

  const sessionId = readCookie(request, SESSION_COOKIE);
  if (sessionId) {
    const key = `session:${sessionId}`;
    const stored = await env.SESSIONS.get(key);

    if (stored) {
      try {
        const { refresh_token } = JSON.parse(stored);
        if (refresh_token) {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: refresh_token }),
          });
        }
      } catch {
        // Best effort — still delete the local session below.
      }
    }

    await env.SESSIONS.delete(key);
  }

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', { maxAge: 0, path: '/' }));
  return new Response(null, { status: 204, headers });
};
