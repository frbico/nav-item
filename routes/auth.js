const express = require('express');
const db = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

const JWT_SECRET = require('../config').server.jwtSecret;
const auth = require('./authMiddleware');
const { rateLimit } = require('express-rate-limit');
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

function getClientIp(req) { return req.ip; }

function getShanghaiTime() {
  const date = new Date();
  // 获取上海时区时间
  const shanghaiTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
  
  // 格式化为 YYYY-MM-DD HH:mm:ss
  const year = shanghaiTime.getFullYear();
  const month = String(shanghaiTime.getMonth() + 1).padStart(2, '0');
  const day = String(shanghaiTime.getDate()).padStart(2, '0');
  const hours = String(shanghaiTime.getHours()).padStart(2, '0');
  const minutes = String(shanghaiTime.getMinutes()).padStart(2, '0');
  const seconds = String(shanghaiTime.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

router.post('/login', loginLimit, (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || username.length > 100 || typeof password !== 'string' || Buffer.byteLength(password) > 72) return res.status(400).json({ error: '参数无效' });
  db.get('SELECT * FROM users WHERE username=?', [username], (err, user) => {
    if (err || !user) return res.status(401).json({ error: '用户名或密码错误' });
    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        // 记录上次登录时间和IP
        const lastLoginTime = user.last_login_time;
        const lastLoginIp = user.last_login_ip;
        // 更新为本次登录（上海时间）
        const now = getShanghaiTime();
        const ip = getClientIp(req);
        db.run('UPDATE users SET last_login_time=?, last_login_ip=? WHERE id=?', [now, ip, user.id]);
        const token = jwt.sign({ id: user.id, username: user.username, version: user.token_version }, JWT_SECRET, { expiresIn: '2h', algorithm: 'HS256', issuer: 'nav-item', audience: 'nav-item-admin' });
        res.json({ token, lastLoginTime, lastLoginIp });
      } else {
        res.status(401).json({ error: '用户名或密码错误' });
      }
    });
  });
});

router.post('/logout', auth, (req, res, next) => {
  db.run('UPDATE users SET token_version=token_version+1 WHERE id=?', [req.user.id], err => {
    if (err) return next(err);
    res.sendStatus(204);
  });
});
module.exports = router; 