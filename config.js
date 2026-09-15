require('dotenv').config();
const jwtSecret = process.env.JWT_SECRET;
if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error('JWT_SECRET must contain at least 32 bytes');
}
const password = process.env.ADMIN_PASSWORD;
if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
  throw new Error('ADMIN_PASSWORD must contain at least 12 characters and at most 72 bytes');
}
module.exports = {
  admin: { username: process.env.ADMIN_USERNAME || 'admin', password },
  server: { port: process.env.PORT || 3000, jwtSecret }
};
