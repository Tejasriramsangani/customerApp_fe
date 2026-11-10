/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node launcher and test helper. */
const crypto = require('node:crypto');
const ORIGIN = 'http://127.0.0.1:3010';
const COOKIE = 'ak_ui_preview';
function configuration(env) {
  const secret = env.ASLIKAATA_UI_PREVIEW_SECRET || '';
  if (env.NODE_ENV !== 'development' || env.ASLIKAATA_UI_PREVIEW_ENABLED !== 'true' ||
      secret.length < 32 || new Set(secret).size < 16 ||
      ['CI', 'VERCEL', 'AWS_EXECUTION_ENV', 'AWS_LAMBDA_FUNCTION_NAME', 'RENDER', 'NETLIFY', 'CAPACITOR_BUILD'].some(name => !!env[name]) ||
      ['APP_ENV', 'ENVIRONMENT', 'DEPLOYMENT_ENV', 'VERCEL_ENV'].some(name => env[name] && !['local', 'development'].includes(env[name]))) {
    throw new Error('Preview requires explicit local development and a unique 32+ character secret with 16+ distinct characters. Hosted environments are prohibited.');
  }
  return secret;
}
function equal(a, b) {
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());
}
function sign(value, secret) { return crypto.createHmac('sha256', secret).update(value).digest('hex'); }
function session(secret, now = Date.now()) { const expiry = String(now + 7200000); return expiry + '.' + sign(expiry, secret); }
function authorized(cookie, secret, now = Date.now()) {
  const value = (cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value) return false;
  const [expiry, signature] = value.split('.');
  return /^\d+$/.test(expiry) && Number(expiry) > now && Number(expiry) <= now + 7200000 && equal(signature || '', sign(expiry, secret));
}
function localRequest(req) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && req.headers.host === '127.0.0.1:3010' &&
    (!req.headers.origin || req.headers.origin === ORIGIN) &&
    !Object.keys(req.headers).some(name => name === 'forwarded' || name.startsWith('x-forwarded-'));
}
module.exports = { ORIGIN, COOKIE, configuration, equal, session, authorized, localRequest };
