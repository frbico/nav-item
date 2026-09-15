const jwt = require('jsonwebtoken');
const db = require('../db');
const { server } = require('../config');
module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });
  let payload;
  try {
    payload = jwt.verify(header.slice(7), server.jwtSecret, { algorithms: ['HS256'], issuer: 'nav-item', audience: 'nav-item-admin' });
    if (!Number.isSafeInteger(payload.id) || !Number.isSafeInteger(payload.version)) throw new Error('invalid claims');
  } catch { return res.status(401).json({ error: '无效token' }); }
  db.get('SELECT id, username, token_version FROM users WHERE id=?', [payload.id], (err, user) => {
    if (err) return next(err);
    if (!user || user.token_version !== payload.version) return res.status(401).json({ error: '会话已失效' });
    req.user = user;
    next();
  });
};
