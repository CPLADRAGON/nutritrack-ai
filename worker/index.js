import { onRequestGet as login } from '../functions/api/auth/login.js';
import { onRequestGet as callback } from '../functions/api/auth/callback.js';
import { onRequestGet as token } from '../functions/api/auth/token.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';

// Same handlers as the Pages Functions version; Workers just needs to route
// them explicitly. Everything else is served from the static assets bundle.
const routes = {
  '/api/auth/login': { GET: login },
  '/api/auth/callback': { GET: callback },
  '/api/auth/token': { GET: token },
  '/api/auth/logout': { POST: logout },
};

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    const route = routes[pathname];

    if (route) {
      const handler = route[request.method];
      if (!handler) {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: Object.keys(route).join(', ') },
        });
      }
      return handler({ request, env, ctx });
    }

    return env.ASSETS.fetch(request);
  },
};
