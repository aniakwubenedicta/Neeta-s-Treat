/* Shared helpers for the Vercel serverless functions (not a route: file starts with "_"). */
const crypto = require('crypto');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const NO_REDIS = 'The website database is not connected yet. In Vercel, add the Upstash Redis integration (Storage tab) and redeploy.';

function hasRedis() { return !!(REDIS_URL && REDIS_TOKEN); }

async function redis(...cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'Database error ' + r.status);
  return j.result;
}
async function getJSON(key) {
  const v = await redis('GET', key);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}
const setJSON = (key, val) => redis('SET', key, JSON.stringify(val));

function send(res, status, obj, extraHeaders) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(extraHeaders || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) { return {}; } }
  return b;
}
const query = req => new URL(req.url, 'http://x').searchParams;
const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

/* ---------- admin login + signed session tokens ---------- */
function adminConfigured() { return !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD); }
function secret() {
  return crypto.createHash('sha256')
    .update('neetaa|' + process.env.ADMIN_PASSWORD + '|' + REDIS_TOKEN + '|' + (process.env.SESSION_SECRET || '')).digest();
}
const b64 = s => Buffer.from(s).toString('base64url');
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token || typeof token !== 'string' || !adminConfigured()) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.e > Date.now() ? p : null;
  } catch (e) { return null; }
}
function isAdmin(req) {
  const h = String(req.headers.authorization || '');
  return !!verify(h.startsWith('Bearer ') ? h.slice(7) : '');
}
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  send(res, 401, { error: 'Please sign in again.' });
  return false;
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function rateLimit(key, max, windowSec) {
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, windowSec);
  return n <= max;
}

/* ---------- Instant order alerts to the owner (Telegram primary, optional Email / CallMeBot) ---------- */
async function sendTelegram(text) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: ctl.signal
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok
      ? { channel: 'Telegram', status: 'sent', detail: 'Telegram' }
      : { channel: 'Telegram', status: 'failed', detail: 'Telegram: ' + (j.description || r.status) };
  } catch (e) {
    return { channel: 'Telegram', status: 'failed', detail: 'Telegram: ' + (e.name === 'AbortError' ? 'timed out' : e.message) };
  } finally { clearTimeout(timer); }
}

async function sendResendEmail(text, subject) {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  const to = String(process.env.NOTIFY_EMAIL || '').trim();
  if (!key || !to) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Neetaa's Treats <onboarding@resend.dev>",
        to: [to],
        subject: subject || "🧁 New Order — Neetaa's Treats",
        text
      }),
      signal: ctl.signal
    });
    const j = await r.json().catch(() => ({}));
    return r.ok
      ? { channel: 'Email', status: 'sent', detail: 'Email' }
      : { channel: 'Email', status: 'failed', detail: 'Email: ' + (j.message || r.status) };
  } catch (e) {
    return { channel: 'Email', status: 'failed', detail: 'Email: ' + (e.name === 'AbortError' ? 'timed out' : e.message) };
  } finally { clearTimeout(timer); }
}

async function sendCallMeBot(text) {
  const apikey = String(process.env.CALLMEBOT_APIKEY || '').trim();
  const phone = String(process.env.NOTIFY_WHATSAPP || '').replace(/\D/g, '');
  if (!apikey || !phone) return null;
  const url = 'https://api.callmebot.com/whatsapp.php?' + new URLSearchParams({ phone: '+' + phone, text, apikey }).toString();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const body = (await r.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return r.ok
      ? { channel: 'WhatsApp', status: 'sent', detail: 'WhatsApp' }
      : { channel: 'WhatsApp', status: 'failed', detail: 'WhatsApp: ' + r.status + ' ' + body };
  } catch (e) {
    return { channel: 'WhatsApp', status: 'failed', detail: 'WhatsApp: ' + (e.name === 'AbortError' ? 'timed out' : e.message) };
  } finally { clearTimeout(timer); }
}

async function sendAlert(text, subject) {
  const attempts = (await Promise.all([
    sendTelegram(text),
    sendResendEmail(text, subject),
    sendCallMeBot(text)
  ])).filter(Boolean);
  if (!attempts.length) {
    return { status: 'not_configured', detail: 'Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel.' };
  }
  const ok = attempts.filter(a => a.status === 'sent');
  const bad = attempts.filter(a => a.status !== 'sent');
  if (ok.length) {
    return { status: 'sent', detail: ok.map(a => a.detail).join(' + ') + (bad.length ? ' (failed: ' + bad.map(b => b.detail).join(', ') + ')' : '') };
  }
  return { status: 'failed', detail: bad.map(b => b.detail).join('; ') };
}

const naira = v => '₦' + Math.round(Number(v || 0)).toLocaleString('en-NG');
function waCustomerPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '234' + d.slice(1);
  return d;
}
function orderMessage(o, host) {
  const waNum = waCustomerPhone(o.phone);
  const replyText = `Hello ${o.customer_name}, we received your Neetaa's Treats order #${o.order_no} (${naira(o.total)})!`;
  const waReply = waNum.length >= 10 ? `https://wa.me/${waNum}?text=${encodeURIComponent(replyText)}` : null;
  const lines = [
    `🧁 NEW ORDER #${o.order_no}`,
    '',
    `Name: ${o.customer_name}`,
    `Phone: ${o.phone}`,
    o.email ? `Email: ${o.email}` : null,
    `${o.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}${o.address ? ': ' + o.address : ''}`,
    o.needed_by ? `Needed by: ${o.needed_by}` : null,
    '',
    'Items:',
    ...(o.order_items || []).map(i => `• ${i.qty} × ${i.name} (${i.category || 'Menu'}) — ${naira(i.line_total)}`),
    '',
    `Subtotal: ${naira(o.subtotal)}`,
    Number(o.delivery_fee) ? `Delivery: ${naira(o.delivery_fee)}` : null,
    `TOTAL: ${naira(o.total)}`,
    o.notes ? `\nNotes: ${o.notes}` : null,
    waReply ? `\nChat customer on WhatsApp:\n${waReply}` : null,
    host ? `\nDashboard: https://${host}/admin.html` : null
  ];
  return lines.filter(l => l !== null).join('\n');
}

module.exports = {
  crypto, redis, getJSON, setJSON, hasRedis, NO_REDIS, send, readBody, query, clientIp,
  adminConfigured, sign, verify, isAdmin, requireAdmin, safeEqual, rateLimit,
  sendAlert, sendWhatsApp: sendAlert, orderMessage, naira
};
