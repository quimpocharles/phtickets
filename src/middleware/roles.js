const { requireRole } = require('./adminAuth');

/**
 * Role-based middleware for protecting routes.
 *
 * These middleware assume adminAuth has already run and populated req.admin.
 * Use them after adminAuth, or pair them with it:
 *
 *   // Inside a router that already calls router.use(adminAuth):
 *   router.delete('/games/:id', requireSuperAdmin, handler);
 *
 *   // On a router without a base adminAuth:
 *   router.get('/tickets/verify/:id', adminAuth, requireScanner, handler);
 *
 * Role hierarchy:
 *   super_admin  → full access (all routes)
 *   admin        → all admin features except hard/destructive deletes
 *   scanner      → ticket verification endpoints only
 */

// Only super_admin — use on destructive or privileged operations (deletes, admin management).
const requireSuperAdmin = requireRole('super_admin');

// admin or super_admin — use on standard admin panel features (CRUD excluding deletes).
const requireAdmin = requireRole('super_admin', 'admin');

// Any authenticated role — use on ticket verification endpoints accessible to gate staff.
const requireScanner = requireRole('super_admin', 'admin', 'scanner');

module.exports = { requireSuperAdmin, requireAdmin, requireScanner };
