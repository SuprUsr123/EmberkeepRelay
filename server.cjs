#!/usr/bin/env node
'use strict';
const http = require('http');

const API_BASE     = process.env.UPSTREAM_API   || 'https://kindlehub-api.arancool3000.workers.dev';
const STATE_BASE   = process.env.UPSTREAM_STATE || 'https://kindlehub-state.arancool3000.workers.dev';
const SPOOF_ORIGIN = process.env.SPOOF_ORIGIN   || 'https://kindlehub.pro';
const PORT         = parseInt(process.env.PORT  || '8787', 10);
const HOST         = process.env.HOST           || '127.0.0.1';

const STRIP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailer','transfer-encoding','upgrade','host',
  'origin','referer','content-length','accept-encoding'
]);

function cors(req) {
  const origin = req.headers.origin || 'null';
  const acrh   = req.headers['access-control-request-headers'];
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': acrh || 'Content-Type, X-KH-Secret, Prefer, Authorization',
    'Access-Control-Expose-Headers':'*',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin'
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

http.createServer(async (req, res) => {
  const chdr = cors(req);

  if (req.method === 'OPTIONS') { res.writeHead(204, chdr); return res.end(); }

  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  let base, path;
  if (u.pathname === '/state' || u.pathname.startsWith('/state/')) {
    base = STATE_BASE;
    const rest = u.pathname.slice('/state'.length);
    path = rest === '' ? '/state' : rest;
  } else if (u.pathname.startsWith('/api/')) {
    base = API_BASE;
    path = u.pathname.slice('/api'.length);
  } else if (u.pathname === '/__health') {
    res.writeHead(200, { ...chdr, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, api: API_BASE, state: STATE_BASE, origin: SPOOF_ORIGIN }));
  } else {
    res.writeHead(404, { ...chdr, 'Content-Type': 'text/plain' });
    return res.end('relay: unknown route ' + u.pathname);
  }

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (STRIP.has(k.toLowerCase())) continue;
    headers[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  headers['origin']     = SPOOF_ORIGIN;
  headers['referer']    = SPOOF_ORIGIN + '/';
  headers['user-agent'] = 'Mozilla/5.0 (X11; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0';

  const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : await readBody(req);

  let upstream;
  try {
    upstream = await fetch(base + path + u.search, {
      method: req.method, headers, body, redirect: 'manual'
    });
  } catch (e) {
    res.writeHead(502, { ...chdr, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'upstream fetch failed', detail: String(e && e.message || e) }));
  }

  const out = {};
  upstream.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (STRIP.has(lk)) return;
    if (lk.startsWith('access-control-')) return;
    if (lk === 'content-encoding' || lk === 'content-length') return;
    out[k] = v;
  });
  Object.assign(out, chdr);

  res.writeHead(upstream.status, out);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}).listen(PORT, HOST, () => {
  console.log(`relay  http://${HOST}:${PORT}`);
  console.log(`  /api/*   -> ${API_BASE}`);
  console.log(`  /state*  -> ${STATE_BASE}`);
  console.log(`  Origin   -> ${SPOOF_ORIGIN}`);
});
