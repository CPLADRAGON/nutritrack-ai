// Shared helpers for the OAuth endpoints. Files starting with "_" are not routed
// by Cloudflare Pages Functions.

export const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export const SESSION_COOKIE = 'nt_session';
export const STATE_COOKIE = 'nt_oauth_state';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // Google revokes refresh tokens unused for 6 months

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });

export const cookie = (name, value, { maxAge, path = '/' } = {}) => {
  const parts = [`${name}=${value}`, 'HttpOnly', 'Secure', 'SameSite=Lax', `Path=${path}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
};

export const readCookie = (request, name) => {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
};

export const originOf = (request) => new URL(request.url).origin;

// Must exactly match a redirect URI registered on the Google OAuth client.
export const redirectUri = (request) => `${originOf(request)}/api/auth/callback`;

export const isConfigured = (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSIONS);

export const redirect = (location, cookies = []) => {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 302, headers });
};
