const fs = require('node:fs');
const crypto = require('node:crypto');
const values = {
  PORT: process.env.PORT || '3000',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || crypto.randomBytes(24).toString('hex'),
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  NAV_SQLITE_DRIVER: process.env.NAV_SQLITE_DRIVER || 'native'
};
if (values.ADMIN_PASSWORD.length < 12 || Buffer.byteLength(values.ADMIN_PASSWORD) > 72 || Buffer.byteLength(values.JWT_SECRET) < 32) throw Error('Password must be 12 characters to 72 bytes; JWT_SECRET must be at least 32 bytes');
if (Object.values(values).some(v => /[\r\n\\"]/ .test(v))) throw Error('Settings cannot contain line breaks, double quotes or backslashes');
fs.writeFileSync('.env', Object.entries(values).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n', {flag:'wx', mode:0o600});
console.log('Created .env (mode 0600). Read ADMIN_PASSWORD there; keep this file private.');
