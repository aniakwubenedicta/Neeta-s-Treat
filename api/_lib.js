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

/* ---------- Instant WhatsApp order alerts to the owner ----------
   Supports (use whichever you configure in Vercel):
   1. Official Meta WhatsApp Cloud API (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID + NOTIFY_WHATSAPP)
   2. TextMeBot free WhatsApp API      (TEXTMEBOT_APIKEY + NOTIFY_WHATSAPP)
   3. CallMeBot free WhatsApp API      (CALLMEBOT_APIKEY + NOTIFY_WHATSAPP)
   (Optional Telegram / Resend email also work if their env vars are set.) */

const cleanParam = s => String(s || '-').replace(/[\r\n\t]+/g, ' | ').replace(/ {4,}/g, ' ').trim().slice(0, 900) || '-';

async function sendMetaWhatsApp(text, order) {
  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const to = String(process.env.NOTIFY_WHATSAPP || '').replace(/\D/g, '');
  if (!token || !phoneId || !to) return null;

  const tplName = String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const tplLang = String(process.env.WHATSAPP_TEMPLATE_LANG || 'en_US').trim();
  let payload;
  if (tplName === 'hello_world') {
    payload = { messaging_product: 'whatsapp', to, type: 'template', template: { name: 'hello_world', language: { code: tplLang } } };
  } else if (tplName) {
    const o = order || {
      order_no: 'TEST', customer_name: 'Test Customer', phone: to,
      order_items: [{ qty: 1, name: 'Vanilla Cake', category: 'Test' }],
      total: 10000, delivery_method: 'delivery', address: 'WhatsApp alerts are working!'
    };
    const itemsStr = (o.order_items || []).map(i => `${i.qty}x ${i.name}${i.category ? ' (' + i.category + ')' : ''}`).join(', ');
    const details = [
      o.delivery_method === 'pickup' ? 'Pickup' : ('Delivery: ' + (o.address || '-')),
      o.needed_by ? 'Needed: ' + o.needed_by : null,
      o.notes ? 'Notes: ' + o.notes : null
    ].filter(Boolean).join(' | ');
    payload = {
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name: tplName,
        language: { code: tplLang },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: cleanParam(o.order_no) },
            { type: 'text', text: cleanParam(o.customer_name) },
            { type: 'text', text: cleanParam(o.phone) },
            { type: 'text', text: cleanParam(itemsStr) },
            { type: 'text', text: cleanParam(naira(o.total)) },
            { type: 'text', text: cleanParam(details) }
          ]
        }]
      }
    };
  } else {
    payload = { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: String(text || '').slice(0, 4000) } };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal
    });
    const j = await r.json().catch(() => ({}));
    return r.ok
      ? { channel: 'WhatsApp (Meta)', status: 'sent', detail: 'WhatsApp (Meta)' }
      : { channel: 'WhatsApp (Meta)', status: 'failed', detail: 'Meta WhatsApp: ' + ((j.error && j.error.message) || r.status) };
  } catch (e) {
    return { channel: 'WhatsApp (Meta)', status: 'failed', detail: 'Meta WhatsApp: ' + (e.name === 'AbortError' ? 'timed out' : e.message) };
  } finally { clearTimeout(timer); }
}

async function sendTextMeBot(text) {
  const apikey = String(process.env.TEXTMEBOT_APIKEY || '').trim();
  const phone = String(process.env.NOTIFY_WHATSAPP || '').replace(/\D/g, '');
  if (!apikey || !phone) return null;
  const url = 'https://api.textmebot.com/send.php?' + new URLSearchParams({ recipient: '+' + phone, apikey, text, json: 'yes' }).toString();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const raw = await r.text();
    let j = null; try { j = JSON.parse(raw); } catch (e) {}
    const ok = r.ok && (!j || j.status === 'success' || /success/i.test(raw));
    const msg = (j && (j.comment || j.message)) || raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return ok
      ? { channel: 'WhatsApp (TextMeBot)', status: 'sent', detail: 'WhatsApp (TextMeBot)' }
      : { channel: 'WhatsApp (TextMeBot)', status: 'failed', detail: 'TextMeBot: ' + (msg || r.status) };
  } catch (e) {
    return { channel: 'WhatsApp (TextMeBot)', status: 'failed', detail: 'TextMeBot: ' + (e.name === 'AbortError' ? 'timed out' : e.message) };
  } finally { clearTimeout(timer); }
}

async function sendCallMeBot(text) {
  const apikey = String(process.env.CALLMEBOT_APIKEY || '').trim();
  const phone = String(process.env.NOTIFY_WHATSAPP || '').replace(/\D/g, '');
  if (!apikey || !phone) return null;
  const url = 'https://api.callmebot.com/whatsapp.php?' + new URLSearchParams({ phone: '+' + phone, text, apikey }).toString();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const body = (await r.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return r.ok
      ? { channel: 'WhatsApp (CallMeBot)', status: 'sent', detail: 'WhatsApp (CallMeBot)' }
      : { channel: 'WhatsApp (CallMeBot)', status: 'failed', detail: 'CallMeBot: ' + r.status + ' ' + body };
  } catch (e) {
    return { channel: 'WhatsApp (CallMeBot)', status: 'failed', detail: 'CallMeBot: ' + (e.name === 'AbortError' ? 'timed out' : e.message) };
  } finally { clearTimeout(timer); }
}

async function sendNtfy(text, subject, order, host) {
  let topic = String(process.env.NTFY_TOPIC || '').trim();
  if (!topic) return null;
  const url = /^https?:\/\//i.test(topic)
    ? topic
    : 'https://ntfy.sh/' + encodeURIComponent(topic.replace(/^\/+/, ''));
  // HTTP headers must be pure ASCII in Node fetch (no ₦ or emojis in headers; body supports full UTF-8)
  const asciiTitle = String(subject || "New Order - Neetaa's Treats").replace(/[^\x20-\x7E]/g, '').trim() || "New Order - Neetaa's Treats";
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Title': asciiTitle.slice(0, 120),
    'Priority': 'high',
    'Tags': 'cake,bell'
  };
  const actions = [];
  if (order && order.phone) {
    const waNum = waCustomerPhone(order.phone);
    if (waNum.length >= 10) {
      const replyText = `Hello ${order.customer_name}, we received your Neetaa's Treats order #${order.order_no} (${naira(order.total)})!`;
      actions.push(`view, Chat on WhatsApp, https://wa.me/${waNum}?text=${encodeURIComponent(replyText)}`);
    }
  }
  if (host) {
    actions.push(`view, Open Dashboard, https://${host}/admin.html`);
    headers['Click'] = `https://${host}/admin.html`;
  }
  if (actions.length) headers['Actions'] = actions.join('; ');
  if (process.env.NTFY_TOKEN) headers['Authorization'] = 'Bearer ' + String(process.env.NTFY_TOKEN).trim();

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { method: 'POST', headers, body: String(text || ''), signal: ctl.signal });
    const body = (await r.text()).trim().slice(0, 120);
    return r.ok
      ? { channel: 'ntfy', status: 'sent', detail: 'ntfy push' }
      : { channel: 'ntfy', status: 'failed', detail: 'ntfy: ' + r.status + ' ' + body };
  } catch (e) {
    return { channel: 'ntfy', status: 'failed', detail: 'ntfy: ' + (e.name === 'AbortError' ? 'timed out' : e.message) };
  } finally { clearTimeout(timer); }
}

async function sendAlert(text, subject, order, host) {
  const attempts = (await Promise.all([
    sendNtfy(text, subject, order, host),
    sendMetaWhatsApp(text, order),
    sendTextMeBot(text),
    sendCallMeBot(text)
  ])).filter(Boolean);
  if (!attempts.length) {
    return { status: 'not_configured', detail: 'Add NTFY_TOPIC in Vercel (Settings -> Environment Variables), then redeploy.' };
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
