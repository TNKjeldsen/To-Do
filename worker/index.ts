/// <reference types="@cloudflare/workers-types" />

/**
 * Ugeplan sync worker.
 *
 * Endpoints:
 *   GET  /sync/:key  → returns { data: <stored JSON> | null }
 *   PUT  /sync/:key  ← stores raw JSON payload, returns { ok: true }
 *
 * Auth model: the URL path :key is the only credential — it doubles as both
 * the storage identifier and the secret. With 32+ random alphanumeric chars
 * (~190 bits of entropy) it is unguessable. Anyone with the URL can read or
 * overwrite the data, so treat it like a password and don't share publicly.
 *
 * The worker is deliberately tiny and stateless. CORS is permissive by
 * default since the URL itself is the secret; restrict via ALLOWED_ORIGINS
 * if you want defense-in-depth.
 */

export interface Env {
  TODO_KV: KVNamespace;
  ALLOWED_ORIGINS?: string;
  MAX_PAYLOAD_BYTES?: string;
}

const DEFAULT_MAX_PAYLOAD = 5 * 1024 * 1024;
const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/;

function corsHeaders(origin: string | null, allowed: string): HeadersInit {
  const list = allowed.split(',').map((s) => s.trim());
  const wildcard = list.includes('*');
  const isAllowed = wildcard || (origin !== null && list.includes(origin));
  const allowOrigin = wildcard
    ? '*'
    : isAllowed && origin
      ? origin
      : list[0] ?? '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS ?? '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({ ok: true, service: 'ugeplan-sync' }, 200, cors);
    }

    const m = url.pathname.match(/^\/sync\/([^/]+)$/);
    if (!m) return json({ error: 'not_found' }, 404, cors);

    const key = m[1]!;
    if (!KEY_RE.test(key)) {
      return json({ error: 'invalid_key' }, 400, cors);
    }

    if (request.method === 'GET') {
      const value = await env.TODO_KV.get(key);
      if (value === null) return json({ data: null }, 200, cors);
      try {
        return json({ data: JSON.parse(value) }, 200, cors);
      } catch {
        return json({ error: 'corrupt' }, 500, cors);
      }
    }

    if (request.method === 'PUT') {
      const max = Number(env.MAX_PAYLOAD_BYTES ?? DEFAULT_MAX_PAYLOAD);
      const contentLength = Number(request.headers.get('content-length') ?? '0');
      if (contentLength > max) {
        return json({ error: 'too_large' }, 413, cors);
      }
      const body = await request.text();
      if (body.length > max) {
        return json({ error: 'too_large' }, 413, cors);
      }
      try {
        JSON.parse(body);
      } catch {
        return json({ error: 'invalid_json' }, 400, cors);
      }
      await env.TODO_KV.put(key, body);
      return json({ ok: true }, 200, cors);
    }

    return json({ error: 'method_not_allowed' }, 405, cors);
  },
};
