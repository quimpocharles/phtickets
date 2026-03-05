const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * Express middleware that verifies the JWT sent in the Authorization header.
 * Attaches the authenticated admin document to req.admin.
 *
 * Expected header:  Authorization: Bearer <token>
 */
async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization token required.' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  const admin = await Admin.findById(payload.sub).select('-password');
  if (!admin) {
    return res.status(401).json({ success: false, message: 'Admin account not found.' });
  }

  req.admin = admin;
  next();
}

module.exports = adminAuth;
