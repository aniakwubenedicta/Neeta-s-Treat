const L = require('./_lib');

/*
  GET    /api/img?id=products/xxx.webp   public: the picture
  POST   /api/img {id, dataUrl}          admin : upload
  DELETE /api/img?id=...                 admin : remove
*/
const okId = id => typeof id === 'string' && /^[\w\-./]{3,160}$/.test(id) && !id.includes('..');

module.exports = async (req, res) => {
  try {
    if (!L.hasRedis()) return L.send(res, 503, { error: L.NO_REDIS });
    if (req.method === 'GET') {
      const id = L.query(req).get('id');
      if (!okId(id)) return L.send(res, 400, { error: 'Bad id' });
      const v = await L.redis('GET', 'neetaa:img:' + id);
      const m = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(v || '');
      if (!m) return L.send(res, 404, { error: 'Not found' });
      res.statusCode = 200;
      res.setHeader('Content-Type', m[1]);
      if (m[1] === 'application/pdf') res.setHeader('Content-Disposition', 'inline; filename="receipt.pdf"');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.end(Buffer.from(m[2], 'base64'));
    }
    if (!L.requireAdmin(req, res)) return;
    if (req.method === 'POST') {
      const { id, dataUrl } = L.readBody(req);
      if (!okId(id)) return L.send(res, 400, { error: 'Bad id' });
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl || '') || dataUrl.length > 3.2e6) {
        return L.send(res, 400, { error: 'Please use a JPG, PNG or WebP image under 2 MB.' });
      }
      await L.redis('SET', 'neetaa:img:' + id, dataUrl);
      return L.send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const id = L.query(req).get('id');
      if (!okId(id)) return L.send(res, 400, { error: 'Bad id' });
      await L.redis('DEL', 'neetaa:img:' + id);
      return L.send(res, 200, { ok: true });
    }
    L.send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    L.send(res, 500, { error: 'Server error: ' + e.message });
  }
};
