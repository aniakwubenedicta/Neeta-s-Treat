const L = require('./_lib');

/* POST /api/order  — a customer places an order. Prices are read from the server, never trusted from the browser.
   The order is saved for the dashboard and a WhatsApp alert is sent to the owner. */
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
    if (!L.hasRedis()) return L.send(res, 503, { error: L.NO_REDIS });
    const b = L.readBody(req);

    const name = String(b.p_name || '').trim();
    const phone = String(b.p_phone || '').trim();
    const method = b.p_method;
    const address = String(b.p_address || '').trim();
    const neededBy = b.p_needed_by ? String(b.p_needed_by).slice(0, 10) : null;
    const items = Array.isArray(b.p_items) ? b.p_items : [];

    if (name.length < 2 || name.length > 100) return L.send(res, 400, { error: 'Please enter your name.' });
    if (!/^[0-9+() \-]{7,20}$/.test(phone)) return L.send(res, 400, { error: 'Please enter a valid phone number.' });
    if (!['delivery', 'pickup'].includes(method)) return L.send(res, 400, { error: 'Choose delivery or pickup.' });
    if (method === 'delivery' && address.length < 5) return L.send(res, 400, { error: 'Please enter a delivery address.' });
    if (neededBy && !/^\d{4}-\d{2}-\d{2}$/.test(neededBy)) return L.send(res, 400, { error: 'Invalid date.' });
    if (!items.length || items.length > 30) return L.send(res, 400, { error: 'Your basket is empty.' });

    const digits = phone.replace(/\D/g, '');
    const okPhone = await L.rateLimit('rl:order:p:' + digits, 5, 3600);
    const okIp = await L.rateLimit('rl:order:ip:' + L.clientIp(req), 20, 3600);
    if (!okPhone || !okIp) return L.send(res, 429, { error: 'Too many orders from this number. Please chat with us on WhatsApp.' });

    const catalog = await L.getJSON('neetaa:catalog');
    if (!catalog || !Array.isArray(catalog.products)) {
      return L.send(res, 503, { error: 'Online ordering is not open yet. Please chat with us on WhatsApp.' });
    }
    const feeSetting = (catalog.settings || []).find(s => s.key === 'delivery_fee');
    const fee = method === 'delivery' ? (Number(feeSetting && feeSetting.value) || 0) : 0;

    const orderId = L.crypto.randomUUID();
    let subtotal = 0;
    const lines = [];
    for (const it of items) {
      const qty = Math.floor(Number(it.qty));
      if (!(qty >= 1 && qty <= 50)) return L.send(res, 400, { error: 'Invalid quantity.' });
      const p = catalog.products.find(x => String(x.id) === String(it.id) && x.section === 'menu' && x.is_available !== false && x.in_stock !== false);
      if (!p) return L.send(res, 409, { error: 'Sorry, one of the items is out of stock or no longer available. Please refresh the menu.' });
      const lineTotal = Number(p.price) * qty;
      subtotal += lineTotal;
      lines.push({ id: L.crypto.randomUUID(), order_id: orderId, product_id: p.id, name: p.name, category: p.category, unit_price: Number(p.price), qty, line_total: lineTotal });
    }

    const orderNo = 1000 + (await L.redis('INCR', 'neetaa:orderno'));
    const now = new Date().toISOString();
    const order = {
      id: orderId, order_no: orderNo, created_at: now, updated_at: now,
      customer_name: name, phone,
      email: String(b.p_email || '').trim().slice(0, 120) || null,
      address: address.slice(0, 300) || null,
      delivery_method: method, needed_by: neededBy,
      notes: String(b.p_notes || '').trim().slice(0, 1000) || null,
      channel: 'website', status: 'new', payment_status: 'unpaid',
      subtotal, delivery_fee: fee, total: subtotal + fee,
      order_items: lines, notify_status: 'pending'
    };
    await L.redis('HSET', 'neetaa:orders', orderId, JSON.stringify(order));

    // Instant WhatsApp alert to the owner (never blocks or fails the customer's order)
    const alert = await L.sendAlert(L.orderMessage(order, req.headers.host), `🧁 New Order #${orderNo}`, order);
    order.notify_status = alert.status;
    order.notify_detail = alert.detail;
    try { await L.redis('HSET', 'neetaa:orders', orderId, JSON.stringify(order)); } catch (e) {}

    L.send(res, 200, { order_no: orderNo, subtotal, delivery_fee: fee, total: subtotal + fee });
  } catch (e) {
    L.send(res, 500, { error: 'We could not place your order right now. Please try again or chat with us on WhatsApp.' });
  }
};
