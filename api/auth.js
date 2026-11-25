const L = require('./_lib');

/* POST /api/auth  { email, password }  ->  { token, user } */
module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
    if (!L.hasRedis()) return L.send(res, 503, { error: L.NO_REDIS });
    if (!L.adminConfigured()) return L.send(res, 503, { error: 'Admin login is not set up. In Vercel → Settings → Environment Variables, add ADMIN_EMAIL and ADMIN_PASSWORD, then redeploy.' });
    if (!(await L.rateLimit('rl:login:' + L.clientIp(req), 10, 900))) {
      return L.send(res, 429, { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
    }
    const b = L.readBody(req);
    const emailOk = String(b.email || '').trim().toLowerCase() === String(process.env.ADMIN_EMAIL).trim().toLowerCase();
    const passOk = L.safeEqual(b.password || '', process.env.ADMIN_PASSWORD);
    if (!emailOk || !passOk) return L.send(res, 401, { error: 'Incorrect email or password.' });
    const exp = Date.now() + 7 * 24 * 3600 * 1000;
    const email = String(process.env.ADMIN_EMAIL).trim();
    L.send(res, 200, { token: L.sign({ e: exp, u: email }), exp, user: { id: 'admin', email } });
  } catch (e) {
    L.send(res, 500, { error: 'Server error: ' + e.message });
  }
};
