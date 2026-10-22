import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  STATE_COOKIE,
  cookie,
  isConfigured,
  json,
  readCookie,
  redirect,
  redirectUri,
} from './_shared.js';

// Google redirects here with a one-time authorization code.
export const onRequestGet = async ({ request, env }) => {
  if (!isConfigured(env)) return json({ error: 'server_misconfigured' }, 500);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const expectedState = readCookie(request, STATE_COOKIE);

  const failed = (reason) => redirect(`/?auth=error&reason=${encodeURIComponent(reason)}`, [
    cookie(STATE_COOKIE, '', { maxAge: 0, path: '/api/auth' }),
  ]);

  if (oauthError) return failed(oauthError);
  if (!code || !state || !expectedState || state !== expectedState) return failed('state_mismatch');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request),
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) return failed('token_exchange_failed');

  const tokens = await response.json();
  if (!tokens.refresh_token) return failed('no_refresh_token');

  // The refresh token never reaches the browser: the browser only gets an
  // opaque session id, and the token itself lives in KV.
  const sessionId = crypto.randomUUID();
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify({ refresh_token: tokens.refresh_token, created_at: Date.now() }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  return redirect('/', [
    cookie(SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL_SECONDS, path: '/' }),
    cookie(STATE_COOKIE, '', { maxAge: 0, path: '/api/auth' }),
  ]);
};
