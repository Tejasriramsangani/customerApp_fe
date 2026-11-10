/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner without added dependencies. */
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const ts = require('typescript'), security = require('./ui-preview-security.cjs');
const secret = crypto.randomBytes(48).toString('base64url');
const env = { NODE_ENV: 'development', ASLIKAATA_UI_PREVIEW_ENABLED: 'true', ASLIKAATA_UI_PREVIEW_SECRET: secret };
function load(file, globals = {}) {
  const sandboxModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new vm.Script(code).runInNewContext({ module: sandboxModule, exports: sandboxModule.exports, structuredClone, Headers, FormData, ...globals });
  return sandboxModule.exports;
}
test('preview refuses production, staging, hosted execution, missing flag and weak secrets', () => {
  assert.equal(security.configuration(env), secret);
  for (const patch of [{ NODE_ENV: 'production' }, { NODE_ENV: 'staging' }, { DEPLOYMENT_ENV: 'staging' }, { CI: 'true' },
    { VERCEL: '1' }, { AWS_EXECUTION_ENV: 'AWS_ECS' }, { ASLIKAATA_UI_PREVIEW_ENABLED: '' }, { ASLIKAATA_UI_PREVIEW_SECRET: '' },
    { ASLIKAATA_UI_PREVIEW_SECRET: 'a'.repeat(40) }]) assert.throws(() => security.configuration({ ...env, ...patch }));
});
test('cookie requires a valid signature and expires after two hours', () => {
  const now = Date.now(), cookie = `${security.COOKIE}=${security.session(secret, now)}`;
  assert.equal(security.authorized(cookie, secret, now), true);
  assert.equal(security.authorized(cookie, secret, now + 7200001), false);
  assert.equal(security.authorized(cookie + 'tamper', secret, now), false);
  assert.equal(security.authorized(cookie, 'wrong secret', now), false);
  assert.equal(security.authorized('', secret, now), false);
});
test('requests must be loopback with exact host and no proxy or cross-origin headers', () => {
  const request = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:3010' } };
  assert.equal(security.localRequest(request), true);
  for (const headers of [{ host: 'attacker.example' }, { origin: 'https://untrusted.example' }, { 'x-forwarded-for': '127.0.0.1' }])
    assert.equal(security.localRequest({ ...request, headers: { ...request.headers, ...headers } }), false);
  assert.equal(security.localRequest({ ...request, socket: { remoteAddress: '192.168.1.2' } }), false);
});
test('fixture addresses are memory-only; authentication and unknown endpoints fail closed', async () => {
  const { createPreviewTransport } = load('src/lib/ui-preview-data.ts'), transport = createPreviewTransport();
  const count = (await transport('/customer/addresses')).data.length;
  await transport('/customer/addresses', { method: 'POST', body: JSON.stringify({ line1: 'Synthetic test' }) });
  assert.equal((await transport('/customer/addresses')).data.length, count + 1);
  assert.equal((await createPreviewTransport()('/customer/addresses')).data.length, count);
  for (const route of ['/auth/otp/send', '/auth/otp/verify', '/auth/refresh', '/unknown', 'http://localhost:4000/api/v1/customer/profile'])
    assert.equal((await transport(route, { method: 'POST' })).success, false);
});
test('preview intercepts all API calls before network, token lookup or refresh', async () => {
  const { createPreviewTransport } = load('src/lib/ui-preview-data.ts');
  let requests = 0;
  const { apiClient } = load('src/lib/api-client.ts', { process: { env: { NODE_ENV: 'development' } },
    window: { location: { origin: security.ORIGIN, pathname: '/ui-preview' } },
    fetch: () => { requests++; throw new Error('Forbidden network'); }, localStorage: { getItem: () => { throw new Error('Forbidden token lookup'); } } });
  apiClient.installUiPreview(createPreviewTransport());
  assert.equal(await apiClient.checkHealth(), true);
  assert.equal((await apiClient.get('/customer/profile')).success, true);
  for (const route of ['/auth/otp/send', '/auth/otp/verify', '/unknown']) assert.equal((await apiClient.post(route, {})).success, false);
  apiClient.clearTokens(); assert.equal(requests, 0);
});
test('normal dev origin and production cannot install preview transport', () => {
  for (const [mode, origin] of [['production', security.ORIGIN], ['development', 'http://localhost:3000']]) {
    const { apiClient } = load('src/lib/api-client.ts', { process: { env: { NODE_ENV: mode } }, window: { location: { origin, pathname: '/ui-preview' } } });
    assert.throws(() => apiClient.installUiPreview(async () => ({})));
  }
});
test('preview context has no JWT or authenticated session and refuses login', () => {
  const React = require('react'), { renderToString } = require('react-dom/server');
  const { previewUser } = load('src/lib/ui-preview-data.ts');
  const context = load('src/context/AuthContext.tsx', { require: name => {
    if (name === '../lib/api-client') return { apiClient: { isUiPreview: () => true } };
    if (name === '../lib/push') return {};
    return require(name);
  } });
  let observed;
  function Child() { observed = context.useAuth(); return null; }
  renderToString(React.createElement(context.AuthProvider, { previewUser }, React.createElement(Child)));
  assert.equal(observed.isAuthenticated, false); assert.equal(observed.accessToken, null);
  assert.throws(() => observed.login('invalid', '', previewUser), /does not authenticate/);
});
test('production preview route returns not found before rendering', () => {
  const { default: Page } = load('src/app/ui-preview/page.tsx', { process: { env: { NODE_ENV: 'production' } }, require: name => {
    if (name === 'next/navigation') return { notFound: () => { throw new Error('404'); } };
    if (name.includes('CustomerUiPreview')) return {};
    return require(name);
  } });
  assert.throws(() => Page(), /404/);
});
