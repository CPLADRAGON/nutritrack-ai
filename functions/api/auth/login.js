import { SCOPES, STATE_COOKIE, cookie, isConfigured, json, redirect, redirectUri } from './_shared.js';

// Starts the Google authorization-code flow.
export const onRequestGet = ({ request, env }) => {
  if (!isConfigured(env)) return json({ error: 'server_misconfigured' }, 500);

  const state = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri(request));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);

  return redirect(url.toString(), [
    cookie(STATE_COOKIE, state, { maxAge: 600, path: '/api/auth' }),
  ]);
};
