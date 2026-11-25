const L = require('./_lib');
const KEY = 'neetaa:catalog';
const LISTS = ['products', 'settings', 'reviews', 'supplies', 'supply_log', 'expenses'];

/*
  GET  /api/catalog            public: visible products, settings, visible reviews
  GET  /api/catalog?full=1     admin : everything
  POST /api/catalog {catalog}  admin : save everything
*/
module.exports = async (req, res) => {
  try {
    if (!L.hasRedis()) return L.send(res, 503, { error: L.NO_REDIS });
    if (req.method === 'GET') {
      const stored = await L.getJSON(KEY);
      if (L.query(req).get('full')) {
        if (!L.requireAdmin(req, res)) return;
        return L.send(res, 200, stored ? { catalog: stored } : { empty: true });
      }
      if (!stored) return L.send(res, 200, { empty: true });
      return L.send(res, 200, {
        products: (stored.products || []).filter(p => p.is_available !== false),
        settings: stored.settings || [],
        reviews: (stored.reviews || []).filter(r => r.is_visible !== false)
      });
    }
    if (req.method === 'POST') {
      if (!L.requireAdmin(req, res)) return;
      const c = L.readBody(req).catalog;
      if (!c || !Array.isArray(c.products) || !c.products.length) return L.send(res, 400, { error: 'Invalid catalogue (no products).' });
      const clean = {};
      LISTS.forEach(k => { clean[k] = Array.isArray(c[k]) ? c[k] : []; });
      await L.setJSON(KEY, clean);
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    L.send(res, 500, { error: 'Server error: ' + e.message });
  }
};
