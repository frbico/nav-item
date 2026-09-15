const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const authMiddleware = require('./authMiddleware');

const router = express.Router();
router.use(require('./validation')('user'));

// 获取当前用户信息
router.get('/profile', authMiddleware, (req, res) => {
  db.get('SELECT id, username FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ message: '服务器错误' });
    }
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json({ data: user });
  });
});

// 获取当前用户详细信息（包括登录信息）
router.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT id, username, last_login_time, last_login_ip FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ message: '服务器错误' });
    }
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json({
      last_login_time: user.last_login_time,
      last_login_ip: user.last_login_ip
    });
  });
});

// 修改密码
router.put('/password', authMiddleware, async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' ||
      !oldPassword || newPassword.length < 12 || Buffer.byteLength(newPassword) > 72 || Buffer.byteLength(oldPassword) > 72) {
    return res.status(400).json({ message: '密码至少12位，最多72字节，且必须为字符串' });
  }
  try {
    const user = await new Promise((resolve, reject) => db.get('SELECT password FROM users WHERE id=?', [req.user.id], (err, row) => err ? reject(err) : resolve(row)));
    if (!user || !await bcrypt.compare(oldPassword, user.password)) return res.status(400).json({ message: '旧密码错误' });
    const hash = await bcrypt.hash(newPassword, 12);
    await new Promise((resolve, reject) => db.run('UPDATE users SET password=?, token_version=token_version+1 WHERE id=?', [hash, req.user.id], err => err ? reject(err) : resolve()));
    res.json({ message: '密码修改成功' });
  } catch (err) { next(err); }
});

// 获取所有用户（管理员功能）
router.get('/', authMiddleware, (req, res) => {
  const { page, pageSize } = req.query;
  if (!page && !pageSize) {
    db.all('SELECT id, username FROM users', (err, users) => {
      if (err) {
        return res.status(500).json({ message: '服务器错误' });
      }
      res.json({ data: users });
    });
  } else {
    const pageNum = parseInt(page) || 1;
    const size = parseInt(pageSize) || 10;
    const offset = (pageNum - 1) * size;
    db.get('SELECT COUNT(*) as total FROM users', [], (err, countRow) => {
      if (err) {
        return res.status(500).json({ message: '服务器错误' });
      }
      db.all('SELECT id, username FROM users LIMIT ? OFFSET ?', [size, offset], (err, users) => {
        if (err) {
          return res.status(500).json({ message: '服务器错误' });
        }
        res.json({
          total: countRow.total,
          page: pageNum,
          pageSize: size,
          data: users
        });
      });
    });
  }
});

module.exports = router; 