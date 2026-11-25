const L = require('./_lib');
const HASH = 'neetaa:orders';
const STATUS = ['new', 'confirmed', 'baking', 'ready', 'delivered', 'cancelled'];
const PAY = ['unpaid', 'paid'];

async function allOrders() {
  const flat = (await L.redis('HGETALL', HASH)) || [];
  const out = [];
  for (let i = 1; i < flat.length; i += 2) { try { out.push(JSON.parse(flat[i])); } catch (e) {} }
  return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}
const str = (v, n) => String(v ?? '').trim().slice(0, n);

/* Admin only.
   GET    /api/orders                       list (newest first, each with order_items)
   POST   /api/orders {kind:'order',rows}   add manual orders
   POST   /api/orders {kind:'items',rows}   add items to an existing order
   POST   /api/orders {action:'test_notify'} send a test WhatsApp alert
   PATCH  /api/orders {id, patch}           change status / payment / notes
   DELETE /api/orders?id=...                delete */
module.exports = async (req, res) => {
  try {
    if (!L.hasRedis()) return L.send(res, 503, { error: L.NO_REDIS });
    if (!L.requireAdmin(req, res)) return;

    if (req.method === 'GET') return L.send(res, 200, { orders: await allOrders() });

    if (req.method === 'POST') {
      const b = L.readBody(req);
      if (b.action === 'test_notify') {
        const r = await L.sendWhatsApp("✅ Test from Neetaa's Treats: your order alerts are working. You'll get a message like this for every new order.");
        return L.send(res, 200, r);
      }
      const rows = Array.isArray(b.rows) ? b.rows.slice(0, 50) : [];
      if (b.kind === 'order') {
        const made = [];
        for (const r of rows) {
          const now = new Date().toISOString();
          const no = 1000 + (await L.redis('INCR', 'neetaa:orderno'));
          const o = {
            id: L.crypto.randomUUID(), order_no: no, created_at: now, updated_at: now,
            customer_name: str(r.customer_name, 100) || 'Customer', phone: str(r.phone, 20),
            email: null, address: str(r.address, 300) || null,
            delivery_method: r.delivery_method === 'pickup' ? 'pickup' : 'delivery',
            needed_by: null, notes: str(r.notes, 1000) || null,
            channel: ['whatsapp', 'manual'].includes(r.channel) ? r.channel : 'manual',
            status: STATUS.includes(r.status) ? r.status : 'confirmed',
            payment_status: PAY.includes(r.payment_status) ? r.payment_status : 'unpaid',
            subtotal: Math.max(0, Number(r.subtotal) || 0), delivery_fee: Math.max(0, Number(r.delivery_fee) || 0),
            total: Math.max(0, Number(r.total) || 0), order_items: []
          };
          await L.redis('HSET', HASH, o.id, JSON.stringify(o));
          made.push(o);
        }
        return L.send(res, 200, { rows: made });
      }
      if (b.kind === 'items') {
        const made = [];
        for (const r of rows) {
          const raw = await L.redis('HGET', HASH, String(r.order_id));
          if (!raw) continue;
          const o = JSON.parse(raw);
          const it = {
            id: L.crypto.randomUUID(), order_id: o.id, product_id: str(r.product_id, 80), name: str(r.name, 120),
            category: str(r.category, 120), unit_price: Math.max(0, Number(r.unit_price) || 0),
            qty: Math.min(100, Math.max(1, Math.floor(Number(r.qty)) || 1)), line_total: Math.max(0, Number(r.line_total) || 0)
          };
          o.order_items = (o.order_items || []).concat(it);
          await L.redis('HSET', HASH, o.id, JSON.stringify(o));
          made.push(it);
        }
        return L.send(res, 200, { rows: made });
      }
      return L.send(res, 400, { error: 'Unknown request.' });
    }

    if (req.method === 'PATCH') {
      const { id, patch } = L.readBody(req);
      const raw = await L.redis('HGET', HASH, String(id));
      if (!raw) return L.send(res, 404, { error: 'Order not found.' });
      const o = JSON.parse(raw);
      if (patch && STATUS.includes(patch.status)) o.status = patch.status;
      if (patch && PAY.includes(patch.payment_status)) o.payment_status = patch.payment_status;
      if (patch && typeof patch.notes === 'string') o.notes = str(patch.notes, 1000) || null;
      o.updated_at = new Date().toISOString();
      await L.redis('HSET', HASH, o.id, JSON.stringify(o));
      return L.send(res, 200, { row: o });
    }

    if (req.method === 'DELETE') {
      const id = L.query(req).get('id');
      if (!id) return L.send(res, 400, { error: 'Missing id.' });
      await L.redis('HDEL', HASH, id);
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    L.send(res, 500, { error: 'Server error: ' + e.message });
  }
};
