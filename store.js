/* =====================================================================
   NEETAA'S TREATS — SELF-CONTAINED LOCAL DATABASE & AUTH ENGINE
   Works 100% independently of Supabase (uses localStorage + optional
   local /api/db file sync + BroadcastChannel live tab sync).
   ===================================================================== */
(function () {
  const STORAGE_KEY = 'neetaa_standalone_db_v1';
  const SESSION_KEY = 'neetaa_standalone_session_v1';
  const DEFAULT_ADMIN = {
    id: 'admin-1',
    email: 'admin@neetaastreats.com',
    password: 'Neetaa2026!'
  };

  const STARTER_PRODUCTS = [
    ['featured', 'Plain cakes', 'Classic flavours, moist and rich cakes with yummy satisfaction.', '', 0, ''],
    ['featured', 'Frosted cakes', 'Buttercream or whipped cream, layered for your occasion.', '', 0, ''],
    ['featured', 'Banana bread', 'Comforting banana bread, including double chocolate options.', '', 0, ''],
    ['featured', 'Parfait', 'Creamy parfait loaded with six fruits and nuts, and also comes with crunchy granola. Available in two generous sizes.', '', 0, ''],
    ['menu', 'Vanilla', '', 'Plain cakes · Size 6', 10000, 'Classic flavours'],
    ['menu', 'Chocolate', '', 'Plain cakes · Size 6', 10500, 'Classic flavours'],
    ['menu', 'Red Velvet', '', 'Plain cakes · Size 6', 10500, 'Classic flavours'],
    ['menu', 'Coconut', '', 'Plain cakes · Size 6', 12000, 'Classic flavours'],
    ['menu', 'Vanilla', '', 'Plain cakes · Size 7', 13000, 'Classic flavours'],
    ['menu', 'Chocolate', '', 'Plain cakes · Size 7', 13500, 'Classic flavours'],
    ['menu', 'Red Velvet', '', 'Plain cakes · Size 7', 13500, 'Classic flavours'],
    ['menu', 'Coconut', '', 'Plain cakes · Size 7', 15000, 'Classic flavours'],
    ['menu', 'Vanilla', '', 'Ice-cream filling · Size 6', 14000, 'Plain cake with ice-cream filling'],
    ['menu', 'Chocolate', '', 'Ice-cream filling · Size 6', 14500, 'Plain cake with ice-cream filling'],
    ['menu', 'Red Velvet', '', 'Ice-cream filling · Size 6', 14500, 'Plain cake with ice-cream filling'],
    ['menu', 'Coconut', '', 'Ice-cream filling · Size 6', 16000, 'Plain cake with ice-cream filling'],
    ['menu', 'Vanilla', '', 'Ice-cream filling · Size 7', 17000, 'Plain cake with ice-cream filling'],
    ['menu', 'Chocolate', '', 'Ice-cream filling · Size 7', 17500, 'Plain cake with ice-cream filling'],
    ['menu', 'Red Velvet', '', 'Ice-cream filling · Size 7', 17500, 'Plain cake with ice-cream filling'],
    ['menu', 'Coconut', '', 'Ice-cream filling · Size 7', 19000, 'Plain cake with ice-cream filling'],
    ['menu', 'One layer', '', 'Frosted cakes · Size 6', 20000, 'Buttercream or whipped cream · same prices'],
    ['menu', 'Two layers', '', 'Frosted cakes · Size 6', 40000, 'Buttercream or whipped cream · same prices'],
    ['menu', 'Three layers', '', 'Frosted cakes · Size 6', 60000, 'Buttercream or whipped cream · same prices'],
    ['menu', 'One layer', '', 'Frosted cakes · Size 7', 25000, 'Buttercream or whipped cream · same prices'],
    ['menu', 'Two layers', '', 'Frosted cakes · Size 7', 50000, 'Buttercream or whipped cream · same prices'],
    ['menu', 'Three layers', '', 'Frosted cakes · Size 7', 75000, 'Buttercream or whipped cream · same prices'],
    ['menu', 'Regular', '', 'Banana bread', 6000, 'Regular and Size 6'],
    ['menu', 'Size 6', '', 'Banana bread', 10500, 'Regular and Size 6'],
    ['menu', 'Double choc · Regular', '', 'Banana bread', 7500, 'Regular and Size 6'],
    ['menu', 'Double choc · Size 6', '', 'Banana bread', 12000, 'Regular and Size 6'],
    ['menu', 'Deluxe · Regular', '', 'Banana bread', 8500, 'Regular and Size 6'],
    ['menu', 'Deluxe · Size 6', '', 'Banana bread', 15000, 'Regular and Size 6'],
    ['menu', '350 ml', '', 'Parfait', 5500, 'Chilled and delicious'],
    ['menu', '500 ml', '', 'Parfait', 8000, 'Chilled and delicious']
  ];

  const STARTER_SUPPLIES = [
    ['Flour', 'kg', 15, 10, 1500],
    ['Sugar', 'kg', 8, 5, 1800],
    ['Butter / Margarine', 'kg', 7, 5, 6000],
    ['Eggs', 'crate', 4, 2, 4500],
    ['Cocoa powder', 'kg', 3, 2, 7000],
    ['Vanilla essence', 'bottle', 2, 1, 2500],
    ['Bananas', 'bunch', 4, 2, 1500],
    ['Whipping cream', 'litre', 5, 3, 5000],
    ['Cake boxes', 'pcs', 35, 20, 500],
    ['Parfait cups', 'pcs', 50, 30, 150]
  ];

  const STARTER_SETTINGS = [
    { key: 'whatsapp_number', value: '2349066434486' },
    { key: 'delivery_fee', value: '0' },
    { key: 'delivery_info', value: 'Delivery available across Lagos' },
    { key: 'payment_instructions', value: 'Pay by bank transfer after we confirm your order on WhatsApp. Pay on delivery is also available.' },
    { key: 'lead_time_note', value: 'Please order at least 2 days ahead for celebration cakes.' }
  ];

  const STARTER_REVIEWS = [
    ['Chidinma A.', 'Frosted Birthday Cake', 5, 'The cake was so moist, rich and beautiful! Everyone at the party asked where I got it from.'],
    ['Tunde O.', 'Double Choc Banana Bread', 5, 'Hands down the best banana bread in Lagos. Warm, soft and loaded with chocolate.'],
    ['Zainab M.', '500 ml Parfait', 5, 'So creamy and fresh! The fruits, nuts and crunchy granola combo is top notch.']
  ];

  function uid() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function createDefaultDB() {
    const baseTime = Date.now() - 3600 * 1000;
    return {
      version: 1,
      admin: { ...DEFAULT_ADMIN },
      next_order_no: 1001,
      products: STARTER_PRODUCTS.map((p, i) => ({
        id: 'prod-' + (i + 1),
        section: p[0],
        name: p[1],
        description: p[2],
        category: p[3],
        price: p[4],
        image_url: '',
        image_path: '',
        is_available: true,
        in_stock: true,
        note: p[5],
        sort_order: i,
        created_at: new Date(baseTime + i * 1000).toISOString(),
        updated_at: new Date(baseTime + i * 1000).toISOString()
      })),
      reviews: STARTER_REVIEWS.map((r, i) => ({
        id: 'rev-' + (i + 1),
        customer_name: r[0],
        item_ordered: r[1],
        rating: r[2],
        comment: r[3],
        image_url: '',
        image_path: '',
        is_visible: true,
        created_at: new Date(baseTime + i * 1000).toISOString(),
        updated_at: new Date(baseTime + i * 1000).toISOString()
      })),
      settings: STARTER_SETTINGS.map(s => ({ ...s })),
      orders: [],
      order_items: [],
      supplies: STARTER_SUPPLIES.map((s, i) => ({
        id: 'sup-' + (i + 1),
        created_at: new Date(baseTime + i * 1000).toISOString(),
        name: s[0],
        unit: s[1],
        quantity: s[2],
        reorder_level: s[3],
        unit_cost: s[4]
      })),
      supply_log: [],
      expenses: [],
      images: {}
    };
  }

  // Clear old Supabase cached catalogue if it existed
  try { localStorage.removeItem('nt_catalogue'); } catch (e) {}

  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('neetaa_store_sync') : null;

  function loadDB() {
    if (MEM) return MEM;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products)) {
          parsed.products.forEach(p => { if (p.in_stock === undefined) p.in_stock = true; });
          if (!Array.isArray(parsed.reviews)) {
            const baseTime = Date.now() - 3600 * 1000;
            parsed.reviews = STARTER_REVIEWS.map((r, i) => ({
              id: 'rev-' + (i + 1),
              customer_name: r[0],
              item_ordered: r[1],
              rating: r[2],
              comment: r[3],
              image_url: '',
              image_path: '',
              is_visible: true,
              created_at: new Date(baseTime + i * 1000).toISOString(),
              updated_at: new Date(baseTime + i * 1000).toISOString()
            }));
          }
          if (!parsed.admin) parsed.admin = { ...DEFAULT_ADMIN };
          if (!parsed.settings) parsed.settings = STARTER_SETTINGS.map(s => ({ ...s }));
          if (!parsed.orders) parsed.orders = [];
          if (!parsed.order_items) parsed.order_items = [];
          if (!parsed.supplies) parsed.supplies = [];
          if (!parsed.supply_log) parsed.supply_log = [];
          if (!parsed.expenses) parsed.expenses = [];
          if (!parsed.images) parsed.images = {};
          if (!parsed.next_order_no) parsed.next_order_no = 1001;
          return parsed;
        }
      }
    } catch (e) {}
    const fresh = createDefaultDB();
    saveDB(fresh, false);
    return fresh;
  }

  function saveDB(db, notify = true) {
    if (MEM) { MEM = db; return; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      throw new Error('Browser storage is full. Please remove large photos or clear space.');
    }
    if (notify && bc) {
      try { bc.postMessage({ type: 'db_updated', ts: Date.now() }); } catch (e) {}
    }
  }

  // ---------- Hosted mode: talks to the Vercel /api functions (shared by all visitors) ----------
  // off    = local preview on this computer (data lives in this browser only)
  // on     = hosted website with its database connected
  // broken = hosted but the server is not set up yet (orders are refused instead of being lost)
  const REMOTE = { mode: 'off', synced: false, error: '' };
  let MEM = null;   // in-memory copy used by customers so they never overwrite the owner's local data
  const isLocalHost = ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname) || location.protocol === 'file:';

  function sessionToken() {
    const s = getSessionUser();
    return s && s.token && s.exp > Date.now() ? s.token : null;
  }
  async function remoteJSON(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const t = sessionToken();
    if (t && !opts.noAuth) headers.Authorization = 'Bearer ' + t;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    let r;
    try {
      r = await fetch(path, { method: opts.method || 'GET', headers, cache: 'no-store', signal: ctl.signal,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    } catch (e) {
      throw new Error('Could not reach the server. Please check your internet connection and try again.');
    } finally { clearTimeout(timer); }
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (r.status === 401 && t && !opts.noAuth) {
      localStorage.removeItem(SESSION_KEY);
      throw new Error('Your session has expired. Please sign in again.');
    }
    if (!r.ok) throw Object.assign(new Error((j && j.error) || 'Server error (' + r.status + ').'), { status: r.status });
    return j || {};
  }

  let pushChain = Promise.resolve();
  function pushNow() {
    if (REMOTE.mode !== 'on' || !REMOTE.synced || MEM || !sessionToken()) return Promise.resolve();
    pushChain = pushChain.catch(() => {}).then(() => {
      const db = loadDB();
      const catalog = { products: db.products, settings: db.settings, reviews: db.reviews,
        supplies: db.supplies, supply_log: db.supply_log, expenses: db.expenses };
      return remoteJSON('/api/catalog', { method: 'POST', body: { catalog } });
    });
    return pushChain;
  }
  async function afterWrite() {
    try { await pushNow(); }
    catch (e) { throw new Error('Not saved to the website: ' + e.message); }
  }

  async function pullCatalog() {
    const admin = !!sessionToken();
    const j = await remoteJSON('/api/catalog' + (admin ? '?full=1' : ''));
    if (admin) {
      MEM = null;
      const db = loadDB();
      if (j.empty) { REMOTE.synced = true; await pushNow(); return; }   // first publish: send the starter catalogue
      const c = j.catalog || {};
      ['products', 'settings', 'reviews', 'supplies', 'supply_log', 'expenses'].forEach(k => { if (Array.isArray(c[k])) db[k] = c[k]; });
      saveDB(db, false);
      REMOTE.synced = true;
    } else {
      const m = createDefaultDB();
      if (!j.empty) {
        if (Array.isArray(j.products)) m.products = j.products;
        if (Array.isArray(j.settings)) m.settings = j.settings;
        if (Array.isArray(j.reviews)) m.reviews = j.reviews;
      }
      m.products.forEach(p => { if (p.in_stock === undefined) p.in_stock = true; });
      MEM = m;
    }
  }
  async function initRemote() {
    try {
      REMOTE.mode = 'on';
      try { await pullCatalog(); }
      catch (e) {
        if (/session has expired/i.test(e.message)) await pullCatalog();   // retry as a normal visitor
        else throw e;
      }
    } catch (e) {
      REMOTE.mode = isLocalHost ? 'off' : 'broken';
      REMOTE.error = e.message || '';
      MEM = null;
    }
  }

  // ---------- Query Builder compatible with supabase.from(table) ----------
  class LocalQuery {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.selectCols = '*';
      this.filters = [];
      this.eqs = [];
      this.orders = [];
      this.limitCount = null;
      this.payload = null;
      this.isSingle = false;
      this.wantSelectAfterWrite = false;
    }
    select(cols = '*') {
      if (this.op === 'select') this.selectCols = cols;
      else this.wantSelectAfterWrite = true;
      return this;
    }
    eq(col, val) {
      this.eqs.push({ col, val });
      this.filters.push(r => String(r[col]) === String(val));
      return this;
    }
    gte(col, val) {
      this.filters.push(r => String(r[col] ?? '') >= String(val));
      return this;
    }
    order(col, opts = { ascending: true }) {
      this.orders.push({ col, asc: opts.ascending !== false });
      return this;
    }
    limit(n) {
      this.limitCount = n;
      return this;
    }
    single() {
      this.isSingle = true;
      return this;
    }
    insert(payload) {
      this.op = 'insert';
      this.payload = payload;
      return this;
    }
    update(payload) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    upsert(payload) {
      this.op = 'upsert';
      this.payload = payload;
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    then(resolve, reject) {
      return this._exec().then(resolve, reject);
    }
    async _execRemote() {
      try {
        if (this.table === 'orders' && this.op === 'select') {
          const j = await remoteJSON('/api/orders');
          let rows = (j.orders || []).filter(r => this.filters.every(fn => fn(r)));
          for (let i = this.orders.length - 1; i >= 0; i--) {
            const { col, asc } = this.orders[i];
            rows.sort((a, b) => {
              const va = a[col] ?? '', vb = b[col] ?? '';
              return va < vb ? (asc ? -1 : 1) : va > vb ? (asc ? 1 : -1) : 0;
            });
          }
          if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
          return { data: this.isSingle ? (rows[0] || null) : rows, error: null };
        }
        if (this.op === 'insert') {
          const items = Array.isArray(this.payload) ? this.payload : [this.payload];
          const j = await remoteJSON('/api/orders', { method: 'POST', body: { kind: this.table === 'orders' ? 'order' : 'items', rows: items } });
          return { data: this.isSingle ? (j.rows[0] || null) : j.rows, error: null };
        }
        const idEq = this.eqs.find(e => e.col === 'id');
        if (this.table === 'orders' && this.op === 'update' && idEq) {
          const j = await remoteJSON('/api/orders', { method: 'PATCH', body: { id: idEq.val, patch: this.payload } });
          return { data: j.row ? [j.row] : [], error: null };
        }
        if (this.table === 'orders' && this.op === 'delete' && idEq) {
          await remoteJSON('/api/orders?id=' + encodeURIComponent(idEq.val), { method: 'DELETE' });
          return { data: [], error: null };
        }
        throw new Error('That action is not supported for orders.');
      } catch (err) {
        return { data: null, error: { message: err.message || String(err) } };
      }
    }
    async _exec() {
      if (REMOTE.mode === 'on' && (this.table === 'orders' || this.table === 'order_items')) return this._execRemote();
      try {
        const db = loadDB();
        const list = db[this.table];
        if (!Array.isArray(list)) throw new Error('Unknown table: ' + this.table);

        if (this.op === 'select') {
          let rows = list.filter(r => this.filters.every(fn => fn(r))).map(r => ({ ...r }));
          if (this.table === 'orders' && String(this.selectCols).includes('order_items')) {
            rows.forEach(o => {
              o.order_items = db.order_items.filter(i => i.order_id === o.id).map(i => ({ ...i }));
            });
          }
          for (let i = this.orders.length - 1; i >= 0; i--) {
            const { col, asc } = this.orders[i];
            rows.sort((a, b) => {
              const va = a[col] ?? '', vb = b[col] ?? '';
              if (va < vb) return asc ? -1 : 1;
              if (va > vb) return asc ? 1 : -1;
              return 0;
            });
          }
          if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
          return { data: this.isSingle ? (rows[0] || null) : rows, error: null };
        }

        if (this.op === 'insert') {
          const items = Array.isArray(this.payload) ? this.payload : [this.payload];
          const inserted = items.map(item => {
            const row = { ...item };
            if (!row.id && this.table !== 'settings') row.id = uid();
            if (!row.created_at && this.table !== 'settings') row.created_at = new Date().toISOString();
            if (this.table === 'products' || this.table === 'orders') row.updated_at = new Date().toISOString();
            if (this.table === 'orders' && !row.order_no) {
              row.order_no = db.next_order_no++;
            }
            if (this.table === 'supplies') {
              if (list.some(s => s.name.toLowerCase() === String(row.name || '').toLowerCase())) {
                throw new Error('A supply with that name already exists.');
              }
            }
            list.push(row);
            if (this.table === 'supply_log') {
              const sup = db.supplies.find(s => s.id === row.supply_id);
              if (sup) {
                sup.quantity = Number(sup.quantity || 0) + Number(row.change || 0);
                if (Number(row.change) > 0 && row.unit_cost != null) {
                  sup.unit_cost = Number(row.unit_cost);
                }
              }
            }
            return { ...row };
          });
          saveDB(db);
          await afterWrite();
          return { data: this.isSingle ? inserted[0] : inserted, error: null };
        }

        if (this.op === 'update') {
          const updated = [];
          list.forEach((row, idx) => {
            if (this.filters.every(fn => fn(row))) {
              list[idx] = { ...row, ...this.payload };
              if (this.table === 'products' || this.table === 'orders') {
                list[idx].updated_at = new Date().toISOString();
              }
              updated.push({ ...list[idx] });
            }
          });
          saveDB(db);
          await afterWrite();
          return { data: this.isSingle ? (updated[0] || null) : updated, error: null };
        }

        if (this.op === 'upsert') {
          const items = Array.isArray(this.payload) ? this.payload : [this.payload];
          const keyField = this.table === 'settings' ? 'key' : 'id';
          const upserted = items.map(item => {
            const existingIdx = list.findIndex(r => String(r[keyField]) === String(item[keyField]));
            if (existingIdx >= 0) {
              list[existingIdx] = { ...list[existingIdx], ...item };
              return { ...list[existingIdx] };
            } else {
              const row = { ...item };
              if (!row[keyField]) row[keyField] = uid();
              list.push(row);
              return { ...row };
            }
          });
          saveDB(db);
          await afterWrite();
          return { data: this.isSingle ? upserted[0] : upserted, error: null };
        }

        if (this.op === 'delete') {
          const remaining = [];
          const removed = [];
          list.forEach(row => {
            if (this.filters.every(fn => fn(row))) removed.push(row);
            else remaining.push(row);
          });
          db[this.table] = remaining;
          if (this.table === 'orders' && removed.length) {
            const ids = new Set(removed.map(r => r.id));
            db.order_items = db.order_items.filter(i => !ids.has(i.order_id));
          }
          if (this.table === 'supplies' && removed.length) {
            const ids = new Set(removed.map(r => r.id));
            db.supply_log = db.supply_log.filter(l => !ids.has(l.supply_id));
          }
          saveDB(db);
          await afterWrite();
          return { data: removed, error: null };
        }

        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message || String(err) } };
      }
    }
  }

  // ---------- RPC functions (is_admin, place_order) ----------
  async function execRpc(name, args = {}) {
    if (name === 'is_admin' && REMOTE.mode === 'on') return { data: !!sessionToken(), error: null };
    if (name === 'place_order' && REMOTE.mode === 'on') {
      try { return { data: await remoteJSON('/api/order', { method: 'POST', body: args, noAuth: true }), error: null }; }
      catch (e) { return { data: null, error: { message: e.message } }; }
    }
    if (name === 'place_order' && REMOTE.mode === 'broken') {
      return { data: null, error: { message: 'Online ordering is temporarily unavailable. Please chat with us on WhatsApp.' } };
    }
    try {
      const db = loadDB();
      if (name === 'is_admin') {
        return { data: true, error: null };
      }
      if (name === 'place_order') {
        const p_name = String(args.p_name || '').trim();
        const p_phone = String(args.p_phone || '').trim();
        const p_email = String(args.p_email || '').trim() || null;
        const p_address = String(args.p_address || '').trim() || null;
        const p_method = args.p_method || 'delivery';
        const p_needed_by = args.p_needed_by || null;
        const p_notes = String(args.p_notes || '').trim() || null;
        const p_channel = ['website', 'whatsapp'].includes(args.p_channel) ? args.p_channel : 'website';
        const p_items = Array.isArray(args.p_items) ? args.p_items : [];

        if (p_name.length < 2 || p_name.length > 100) throw new Error('Please enter your name.');
        if (!/^[0-9+() \-]{7,20}$/.test(p_phone)) throw new Error('Please enter a valid phone number.');
        if (!['delivery', 'pickup'].includes(p_method)) throw new Error('Choose delivery or pickup.');
        if (p_method === 'delivery' && (!p_address || p_address.length < 5)) throw new Error('Please enter a delivery address.');
        if (!p_items.length) throw new Error('Your basket is empty.');

        let fee = 0;
        if (p_method === 'delivery') {
          const feeSetting = db.settings.find(s => s.key === 'delivery_fee');
          fee = Number((feeSetting && feeSetting.value) || 0) || 0;
        }

        const orderId = uid();
        const orderNo = db.next_order_no++;
        let subtotal = 0;
        const newItems = [];

        for (const item of p_items) {
          const qty = Number(item.qty || 0);
          if (qty < 1 || qty > 50) throw new Error('Invalid quantity.');
          const prod = db.products.find(p => String(p.id) === String(item.id) && p.is_available && p.in_stock !== false && p.section === 'menu');
          if (!prod) throw new Error('Sorry, one of the items is out of stock or no longer available. Please refresh the menu.');
          const lineTotal = Number(prod.price) * qty;
          subtotal += lineTotal;
          newItems.push({
            id: uid(),
            order_id: orderId,
            product_id: prod.id,
            name: prod.name,
            category: prod.category,
            unit_price: Number(prod.price),
            qty,
            line_total: lineTotal
          });
        }

        const nowIso = new Date().toISOString();
        const order = {
          id: orderId,
          order_no: orderNo,
          created_at: nowIso,
          updated_at: nowIso,
          customer_name: p_name,
          phone: p_phone,
          email: p_email,
          address: p_address,
          delivery_method: p_method,
          needed_by: p_needed_by,
          notes: p_notes,
          channel: p_channel,
          status: 'new',
          payment_status: 'unpaid',
          subtotal,
          delivery_fee: fee,
          total: subtotal + fee
        };

        db.orders.push(order);
        db.order_items.push(...newItems);
        saveDB(db);
        return {
          data: { order_no: orderNo, subtotal, delivery_fee: fee, total: subtotal + fee },
          error: null
        };
      }
      return { data: null, error: { message: 'Unknown RPC: ' + name } };
    } catch (err) {
      return { data: null, error: { message: err.message || String(err) } };
    }
  }

  // ---------- Auth (100% local, no Supabase) ----------
  const authListeners = [];
  function getSessionUser() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return s && s.user ? s : null;
    } catch (e) { return null; }
  }

  const localAuth = {
    async getSession() {
      return { data: { session: getSessionUser() }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const db = loadDB();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const adminEmail = String(db.admin.email || DEFAULT_ADMIN.email).trim().toLowerCase();
      const validEmail = cleanEmail === adminEmail || cleanEmail === 'admin@neetaastreats.com' || cleanEmail === 'admin';
      if (!validEmail || password !== db.admin.password) {
        return {
          data: { user: null, session: null },
          error: { message: 'Incorrect email or password.' }
        };
      }
      const user = { id: db.admin.id, email: db.admin.email };
      const session = { user, access_token: 'local-token' };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      authListeners.forEach(fn => { try { fn('SIGNED_IN', session); } catch (e) {} });
      return { data: { user, session }, error: null };
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      authListeners.forEach(fn => { try { fn('SIGNED_OUT', null); } catch (e) {} });
      return { error: null };
    },
    async updateUser({ email, password }) {
      const db = loadDB();
      if (email) db.admin.email = String(email).trim();
      if (password) db.admin.password = String(password);
      saveDB(db, false);
      const user = { id: db.admin.id, email: db.admin.email };
      const session = { user, access_token: 'local-token' };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { data: { user }, error: null };
    },
    onAuthStateChange(cb) {
      authListeners.push(cb);
      return { data: { subscription: { unsubscribe() {} } } };
    }
  };

  // Sign-in: the hosted site checks the password on the server; local preview checks it in this browser
  const auth = {
    async getSession() {
      await ready;
      if (REMOTE.mode === 'on') {
        const s = getSessionUser();
        return { data: { session: s && s.token && s.exp > Date.now() ? s : null }, error: null };
      }
      return localAuth.getSession();
    },
    async signInWithPassword(creds) {
      await ready;
      if (REMOTE.mode === 'broken') {
        return { data: { user: null, session: null }, error: { message: 'The website server is not set up yet. ' + (REMOTE.error || '') } };
      }
      if (REMOTE.mode !== 'on') return localAuth.signInWithPassword(creds);
      try {
        const j = await remoteJSON('/api/auth', { method: 'POST', noAuth: true, body: { email: creds.email, password: creds.password } });
        const session = { user: j.user, token: j.token, exp: j.exp, access_token: j.token };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        REMOTE.synced = false;
        await pullCatalog();
        authListeners.forEach(fn => { try { fn('SIGNED_IN', session); } catch (e) {} });
        return { data: { user: j.user, session }, error: null };
      } catch (e) {
        return { data: { user: null, session: null }, error: { message: e.message } };
      }
    },
    signOut: () => localAuth.signOut(),
    async updateUser(p) {
      await ready;
      if (REMOTE.mode === 'on') return { data: null, error: { message: 'On the live website the password is set in Vercel (ADMIN_PASSWORD).' } };
      return localAuth.updateUser(p);
    },
    onAuthStateChange: cb => localAuth.onAuthStateChange(cb)
  };

  // ---------- Storage (stores product photos as data URLs in the local DB) ----------
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Could not read image file.'));
      r.readAsDataURL(blob);
    });
  }

  const localStorageApi = {
    from() {
      return {
        async upload(path, blob) {
          try {
            const dataUrl = await blobToDataURL(blob);
            const db = loadDB();
            db.images[path] = dataUrl;
            saveDB(db, false);
            return { data: { path }, error: null };
          } catch (err) {
            return { data: null, error: { message: err.message || 'Could not save image.' } };
          }
        },
        getPublicUrl(path) {
          const db = loadDB();
          return { data: { publicUrl: db.images[path] || '' } };
        },
        async remove(paths) {
          const db = loadDB();
          (paths || []).forEach(p => { delete db.images[p]; });
          saveDB(db, false);
          return { data: paths, error: null };
        }
      };
    }
  };

  // Photos: on the live website they are stored on the server so every visitor sees them
  const storage = {
    from() {
      const local = localStorageApi.from();
      return {
        async upload(path, blob, opts) {
          if (REMOTE.mode !== 'on') return local.upload(path, blob, opts);
          try {
            await remoteJSON('/api/img', { method: 'POST', body: { id: path, dataUrl: await blobToDataURL(blob) } });
            return { data: { path }, error: null };
          } catch (e) { return { data: null, error: { message: e.message } }; }
        },
        getPublicUrl(path) {
          return REMOTE.mode === 'on' ? { data: { publicUrl: '/api/img?id=' + encodeURIComponent(path) } } : local.getPublicUrl(path);
        },
        async remove(paths) {
          if (REMOTE.mode !== 'on') return local.remove(paths);
          for (const p of paths || []) { try { await remoteJSON('/api/img?id=' + encodeURIComponent(p), { method: 'DELETE' }); } catch (e) {} }
          return { data: paths, error: null };
        }
      };
    }
  };

  const ready = initRemote();

  const client = {
    from: table => new LocalQuery(table),
    rpc: (name, args) => execRpc(name, args),
    auth,
    storage
  };

  window.NeetaaStore = {
    client,
    loadDB,
    saveDB,
    getAdminCredentials() {
      const db = loadDB();
      return { email: db.admin.email, password: db.admin.password };
    },
    ready,
    get mode() { return REMOTE.mode; },
    async testNotify() {
      if (REMOTE.mode !== 'on') throw new Error('WhatsApp alerts only work on the live (hosted) website.');
      return remoteJSON('/api/orders', { method: 'POST', body: { action: 'test_notify' } });
    },
    onSync(cb) {
      // hosted site: re-check the catalogue every 90 seconds so price/stock changes appear without a reload
      ready.then(() => {
        if (REMOTE.mode === 'on' && !sessionToken()) setInterval(async () => { try { await pullCatalog(); cb(); } catch (e) {} }, 90000);
      });
      if (bc) bc.addEventListener('message', () => cb());
      window.addEventListener('storage', e => {
        if (e.key === STORAGE_KEY) cb();
      });
    }
  };

  // Provide drop-in window.supabase.createClient so admin.html works without any external library
  window.supabase = {
    createClient() {
      return client;
    }
  };
})();
