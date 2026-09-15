const imageURL = value => !value || (typeof value === 'string' && (value.startsWith('/uploads/') && /^\/uploads\/[a-zA-Z0-9._-]+$/.test(value) || httpURL(value)));
function httpURL(value) { try { const u = new URL(value); return typeof value === 'string' && value.length <= 2048 && ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; } }
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
module.exports = function validate(kind) {
  return (req, res, next) => {
    for (const key of ['page', 'pageSize']) if (req.query[key] !== undefined && (!/^\d+$/.test(req.query[key]) || Number(req.query[key]) < 1 || Number(req.query[key]) > (key === 'pageSize' ? 100 : 1000000))) return res.status(400).json({ error: '分页参数无效' });
    if (!['POST', 'PUT'].includes(req.method)) return next();
    const b = req.body;
    let ok = b && !Array.isArray(b) && typeof b === 'object';
    if (kind === 'menu') ok = ok && text(b.name);
    if (kind === 'card') ok = ok && !!(b.menu_id || b.sub_menu_id);
    if (kind === 'card' || kind === 'friend') ok = ok && text(b.title) && httpURL(b.url);
    if (kind === 'ad') ok = ok && imageURL(b.img) && !!b.img && httpURL(b.url) && (req.method !== 'POST' || ['left','right'].includes(b.position));
    if (b && b.order !== undefined) ok = ok && Number.isSafeInteger(b.order) && Math.abs(b.order) <= 1000000;
    for (const key of ['menu_id','sub_menu_id']) if (b && b[key] !== undefined && b[key] !== null) ok = ok && Number.isSafeInteger(b[key]) && b[key] > 0;
    for (const key of ['logo_url','logo']) if (b && b[key] !== undefined) ok = ok && imageURL(b[key]);
    if (b && b.custom_logo_path) ok = ok && typeof b.custom_logo_path === 'string' && /^[a-zA-Z0-9_-]+\.png$/.test(b.custom_logo_path);
    if (b && b.desc !== undefined && b.desc !== null) ok = ok && typeof b.desc === 'string' && b.desc.length <= 5000;
    if (!ok) return res.status(400).json({ error: '输入参数无效' });
    next();
  };
};
