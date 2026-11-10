/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local Node development server. */
const http = require('node:http');
const path = require('node:path');
const security = require('./ui-preview-security.cjs');
let secret;
try { secret = security.configuration(process.env); }
catch (error) { console.error(error.message); process.exit(1); }
process.env.ASLIKAATA_LOCAL_UI_PREVIEW_RUNTIME = '1';
const unlock = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local UI preview</title></head><body>
<h1>Local UI preview</h1><p>Synthetic customer only. No real authentication, OTP delivery, backend requests or database writes.</p>
<form method="post" action="/__ui-preview/session"><label>Local preview secret <input type="password" name="secret" required maxlength="512" autocomplete="off"></label><button>Unlock preview</button></form></body></html>`;
let attempts = [];
async function main() {
  const app = require('next')({ dev: true, webpack: true, dir: path.resolve(__dirname, '..'), hostname: '127.0.0.1', port: 3010 });
  await app.prepare();
  const handle = app.getRequestHandler();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:3010; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    if (!security.localRequest(req)) { res.writeHead(403); res.end('Local preview only.'); return; }
    const pathname = new URL(req.url, security.ORIGIN).pathname;
    if (pathname === '/__ui-preview/session') {
      if (req.method === 'POST') {
        if (req.headers.origin !== security.ORIGIN || req.headers['content-type'] !== 'application/x-www-form-urlencoded') { res.writeHead(403); res.end(); return; }
        attempts = attempts.filter(time => time > Date.now() - 60000);
        if (attempts.length >= 5) { res.writeHead(429); res.end('Retry after one minute.'); return; }
        attempts.push(Date.now());
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 2048) { res.writeHead(413); res.end(); return; } }
        if (!security.equal(new URLSearchParams(body).get('secret') || '', secret)) { res.writeHead(401); res.end('Invalid preview secret.'); return; }
        res.setHeader('Set-Cookie', `${security.COOKIE}=${security.session(secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`);
        res.writeHead(303, { Location: '/ui-preview' }); res.end(); return;
      }
      if (req.method === 'DELETE' && req.headers.origin === security.ORIGIN) {
        res.setHeader('Set-Cookie', `${security.COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`); res.end(); return;
      }
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
      const valid = security.authorized(req.headers.cookie, secret);
      res.writeHead(valid ? 200 : 401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ preview: valid })); return;
    }
    if (!security.authorized(req.headers.cookie, secret)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(unlock); return; }
    if (pathname === '/') { res.writeHead(302, { Location: '/ui-preview' }); res.end(); return; }
    if (pathname.startsWith('/api/') || (!pathname.startsWith('/_next/') && pathname !== '/ui-preview' && !/\.(png|jpg|jpeg|webp|svg|ico|woff2?|css)$/.test(pathname))) { res.writeHead(403); res.end('Unavailable in isolated preview.'); return; }
    try { await handle(req, res); } catch { if (!res.headersSent) res.writeHead(500); res.end('Preview rendering failed.'); }
  });
  server.on('upgrade', (req, socket, head) => {
    if (!security.localRequest(req) || !security.authorized(req.headers.cookie, secret)) { socket.destroy(); return; }
    app.getUpgradeHandler()(req, socket, head);
  });
  server.listen(3010, '127.0.0.1', () => console.log('Isolated UI preview: ' + security.ORIGIN));
}
main().catch(() => { console.error('Preview startup failed; check port 3010 availability.'); process.exit(1); });
