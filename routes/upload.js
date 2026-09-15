const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
const auth = require('./authMiddleware');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });
router.post('/', auth, rateLimit({ windowMs: 60000, limit: 20 }), upload.single('logo'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  try {
    const options = { limitInputPixels: 16777216, animated: false };
    const metadata = await sharp(req.file.buffer, options).metadata();
    if (!['png', 'jpeg', 'gif', 'webp'].includes(metadata.format)) return res.status(400).json({ error: '仅允许PNG/JPEG/GIF/WebP图片' });
    const data = await sharp(req.file.buffer, options).rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const filename = randomUUID() + '.png';
    await fs.writeFile(path.join(__dirname, '../uploads', filename), data, { flag: 'wx' });
    res.json({ filename, url: '/uploads/' + filename });
  } catch (err) {
    if (err.code && ['EACCES','ENOSPC','ENOENT'].includes(err.code)) return next(err);
    res.status(400).json({ error: '无法处理图片' });
  }
});
module.exports = router;
