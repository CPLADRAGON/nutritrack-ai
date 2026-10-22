var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// functions/api/auth/_shared.js
var SCOPES = "https://www.googleapis.com/auth/drive.file";
var SESSION_COOKIE = "nt_session";
var STATE_COOKIE = "nt_oauth_state";
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers
  }
}), "json");
var cookie = /* @__PURE__ */ __name((name, value, { maxAge, path = "/" } = {}) => {
  const parts = [`${name}=${value}`, "HttpOnly", "Secure", "SameSite=Lax", `Path=${path}`];
  if (maxAge !== void 0) parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}, "cookie");
var readCookie = /* @__PURE__ */ __name((request, name) => {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}, "readCookie");
var originOf = /* @__PURE__ */ __name((request) => new URL(request.url).origin, "originOf");
var redirectUri = /* @__PURE__ */ __name((request) => `${originOf(request)}/api/auth/callback`, "redirectUri");
var isConfigured = /* @__PURE__ */ __name((env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSIONS), "isConfigured");
var redirect = /* @__PURE__ */ __name((location, cookies = []) => {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}, "redirect");

// functions/api/auth/login.js
var onRequestGet = /* @__PURE__ */ __name(({ request, env }) => {
  if (!isConfigured(env)) return json({ error: "server_misconfigured" }, 500);
  const state = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return redirect(url.toString(), [
    cookie(STATE_COOKIE, state, { maxAge: 600, path: "/api/auth" })
  ]);
}, "onRequestGet");

// functions/api/auth/callback.js
var onRequestGet2 = /* @__PURE__ */ __name(async ({ request, env }) => {
  if (!isConfigured(env)) return json({ error: "server_misconfigured" }, 500);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const expectedState = readCookie(request, STATE_COOKIE);
  const failed = /* @__PURE__ */ __name((reason) => redirect(`/?auth=error&reason=${encodeURIComponent(reason)}`, [
    cookie(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth" })
  ]), "failed");
  if (oauthError) return failed(oauthError);
  if (!code || !state || !expectedState || state !== expectedState) return failed("state_mismatch");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) return failed("token_exchange_failed");
  const tokens = await response.json();
  if (!tokens.refresh_token) return failed("no_refresh_token");
  const sessionId = crypto.randomUUID();
  await env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify({ refresh_token: tokens.refresh_token, created_at: Date.now() }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
  return redirect("/", [
    cookie(SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL_SECONDS, path: "/" }),
    cookie(STATE_COOKIE, "", { maxAge: 0, path: "/api/auth" })
  ]);
}, "onRequestGet");

// functions/api/auth/token.js
var onRequestGet3 = /* @__PURE__ */ __name(async ({ request, env }) => {
  if (!isConfigured(env)) return json({ error: "server_misconfigured" }, 500);
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return json({ error: "not_authenticated" }, 401);
  const key = `session:${sessionId}`;
  const stored = await env.SESSIONS.get(key);
  if (!stored) return json({ error: "not_authenticated" }, 401);
  let session;
  try {
    session = JSON.parse(stored);
  } catch {
    return json({ error: "not_authenticated" }, 401);
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: session.refresh_token,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (body.error === "invalid_grant") {
      await env.SESSIONS.delete(key);
      return json({ error: "not_authenticated" }, 401);
    }
    return json({ error: "token_refresh_failed" }, 502);
  }
  const tokens = await response.json();
  if (tokens.refresh_token && tokens.refresh_token !== session.refresh_token) {
    session.refresh_token = tokens.refresh_token;
    await env.SESSIONS.put(key, JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 180 });
  }
  return json({ access_token: tokens.access_token, expires_in: tokens.expires_in });
}, "onRequestGet");

// functions/api/auth/logout.js
var onRequestPost = /* @__PURE__ */ __name(async ({ request, env }) => {
  if (!isConfigured(env)) return new Response(null, { status: 204 });
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (sessionId) {
    const key = `session:${sessionId}`;
    const stored = await env.SESSIONS.get(key);
    if (stored) {
      try {
        const { refresh_token } = JSON.parse(stored);
        if (refresh_token) {
          await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: refresh_token })
          });
        }
      } catch {
      }
    }
    await env.SESSIONS.delete(key);
  }
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", { maxAge: 0, path: "/" }));
  return new Response(null, { status: 204, headers });
}, "onRequestPost");

// worker/index.js
var routes = {
  "/api/auth/login": { GET: onRequestGet },
  "/api/auth/callback": { GET: onRequestGet2 },
  "/api/auth/token": { GET: onRequestGet3 },
  "/api/auth/logout": { POST: onRequestPost }
};
var index_default = {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const route = routes[pathname];
    if (route) {
      const handler = route[request.method];
      if (!handler) {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: Object.keys(route).join(", ") }
        });
      }
      return handler({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
