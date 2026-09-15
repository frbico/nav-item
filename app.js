const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const menuRoutes = require('./routes/menu');
const cardRoutes = require('./routes/card');
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const adRoutes = require('./routes/ad');
const friendRoutes = require('./routes/friend');
const userRoutes = require('./routes/user');
const compression = require('compression');
const app = express();

const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(helmet({ contentSecurityPolicy: { directives: { 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'https:', 'data:'], 'upgrade-insecure-requests': null } }, strictTransportSecurity: false, crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(express.json());
app.use(compression());
app.use('/uploads', (req, res, next) => {
  if (!/^\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/i.test(req.path)) return res.sendStatus(404);
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  next();
}, express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'web/dist')));

app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/uploads') &&
    !fs.existsSync(path.join(__dirname, 'web/dist', req.path))
  ) {
    res.sendFile(path.join(__dirname, 'web/dist', 'index.html'));
  } else {
    next();
  }
});

app.use('/api/menus', menuRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', authRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);

app.use((err, req, res, next) => {
  const status = err.code === 'LIMIT_FILE_SIZE' || err.type === 'entity.too.large' ? 413 : err.name === 'MulterError' || err instanceof SyntaxError || err.code === 'SQLITE_CONSTRAINT' ? 400 : 500;
  if (status === 500) console.error(err.message);
  res.status(status).json({ error: status === 500 ? '服务器错误' : '请求无效或超出限制' });
});
app.listen(PORT, () => {
  console.log(`server is running at http://localhost:${PORT}`);
}); 