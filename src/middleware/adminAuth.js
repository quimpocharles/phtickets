const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * Express middleware that verifies the JWT sent in the Authorization header.
 * Attaches the authenticated admin document to req.admin.
 * Rejects soft-deleted accounts even if their token is still valid.
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
  if (!admin || admin.isDeleted) {
    return res.status(401).json({ success: false, message: 'Admin account not found.' });
  }

  req.admin = admin;
  next();
}

/**
 * Middleware factory that restricts a route to admins with specific roles.
 * Must be used after adminAuth.
 *
 * Usage:  router.delete('/admins/:id', adminAuth, requireRole('super_admin'), handler)
 *
 * @param {...string} roles  One or more allowed role values.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    next();
  };
}

module.exports = adminAuth;
module.exports.requireRole = requireRole;
