const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Admin = require('../models/Admin');
const Game = require('../models/Game');
const TicketType = require('../models/TicketType');
const TicketReservation = require('../models/TicketReservation');
const ReportRecipient = require('../models/ReportRecipient');
const Team = require('../models/Team');
const { uploadBanner, uploadTeamLogo } = require('../services/cloudinary');
const adminAuth = require('../middleware/adminAuth');
const { requireSuperAdmin, requireAdmin } = require('../middleware/roles');
const { generateGateReconciliationReport } = require('../services/gateReconciliationService');
const ScanLog = require('../models/ScanLog');
const Order = require('../models/Order');

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/setup-status  (public)
// Returns whether the first-time setup has been completed.
// Used by the frontend to show/hide the register page.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/setup-status', async (_req, res) => {
  try {
    const count = await Admin.countDocuments();
    return res.json({ success: true, data: { setupRequired: count === 0 } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/register  (public — only works when no admin exists)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const existing = await Admin.countDocuments();
    if (existing > 0) {
      return res.status(403).json({
        success: false,
        message: 'Setup already complete. Registration is disabled.',
      });
    }

    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    // First admin is always super_admin
    const admin = await Admin.create({ name: name || null, email, password, role: 'super_admin' });

    const token = jwt.sign(
      { sub: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' }
    );

    return res.status(201).json({
      success: true,
      data: {
        token,
        admin: { _id: admin._id, email: admin.email, name: admin.name, role: admin.role },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/login  (public)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required.' });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.verifyPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (admin.isDeleted) {
      return res.status(403).json({ success: false, message: 'Account disabled.' });
    }

    const token = jwt.sign(
      { sub: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' }
    );

    return res.json({
      success: true,
      data: {
        token,
        admin: { _id: admin._id, email: admin.email, name: admin.name, role: admin.role },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// All routes below this line require a valid JWT and at least the admin role.
// Scanners are blocked from the admin panel entirely — they only use /tickets/verify.
// ─────────────────────────────────────────────────────────────────────────────
router.use(adminAuth, requireAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  res.json({ success: true, data: req.admin });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/admins  — list all non-deleted admins (super_admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/admins', requireSuperAdmin, async (_req, res) => {
  try {
    const admins = await Admin.find()
      .select('name email role createdAt isDeleted')
      .sort({ createdAt: 1 });

    const data = admins.map(({ _id, name, email, role, createdAt, isDeleted }) => ({
      _id,
      name,
      email,
      role,
      createdAt,
      status: isDeleted ? 'deleted' : 'active',
    }));

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/admins  — create a new admin or scanner account (super_admin only)
// Body: { name?, email, password, role }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/admins', requireSuperAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }
  if (!['admin', 'scanner'].includes(role)) {
    return res.status(400).json({ success: false, message: "role must be 'admin' or 'scanner'." });
  }

  try {
    const admin = await Admin.create({ name: name || null, email, password, role });
    return res.status(201).json({
      success: true,
      data: { _id: admin._id, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/admins/:id  — update role (super_admin only)
// Body: { role }  — only 'admin' or 'scanner' are accepted (can't promote to super_admin)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/admins/:id', requireSuperAdmin, async (req, res) => {
  const { role } = req.body;

  if (!['admin', 'scanner'].includes(role)) {
    return res.status(400).json({ success: false, message: "role must be 'admin' or 'scanner'." });
  }

  try {
    const admin = await Admin.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { role } },
      { new: true, select: 'name email role createdAt' }
    );

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    return res.json({ success: true, data: admin });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/admins/:id  — soft-delete an admin account (super_admin only)
// A super_admin cannot delete their own account.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/admins/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.admin._id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }

  if (req.query.permanent === 'true' && req.admin.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
  }

  const permanent = req.query.permanent === 'true';

  try {
    if (permanent) {
      const admin = await Admin.findByIdAndDelete(req.params.id);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin not found.' });
      }
      return res.json({ success: true, message: `Account "${admin.email}" has been permanently deleted.` });
    }

    const admin = await Admin.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    return res.json({ success: true, message: `Account "${admin.email}" has been deactivated.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/teams  — list all teams sorted by name
// ─────────────────────────────────────────────────────────────────────────────
router.get('/teams', async (_req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    return res.json({ success: true, data: teams });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/teams  — create a team (logo upload optional)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/teams', (req, res, next) => {
  uploadTeamLogo(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  const { name, monicker } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ success: false, message: 'name is required.' });
  }

  try {
    const team = await Team.create({
      name:     name.trim(),
      monicker: monicker?.trim() || null,
      logo:     req.file ? req.file.path : null,
    });
    return res.status(201).json({ success: true, data: team });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A team with this name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/teams/:id  — update name, monicker, or logo
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/teams/:id', (req, res, next) => {
  uploadTeamLogo(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const updates = {};
    if (req.body.name     !== undefined) updates.name     = req.body.name.trim();
    if (req.body.monicker !== undefined) updates.monicker = req.body.monicker?.trim() || null;
    if (req.file)                        updates.logo     = req.file.path;

    const team = await Team.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }
    return res.json({ success: true, data: team });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A team with this name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/teams/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/teams/:id', requireSuperAdmin, async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }
    return res.json({ success: true, message: `Team "${team.name}" has been deleted.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/games
// Create a new game. Banner image is optional (uploaded to Cloudinary).
// Body: description (string), venue, gameDate, eventEndDate
// ─────────────────────────────────────────────────────────────────────────────
router.post('/games', (req, res, next) => {
  uploadBanner(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  const { description, venue, gameDate, eventEndDate } = req.body;

  if (!description?.trim() || !venue || !gameDate || !eventEndDate) {
    return res.status(400).json({
      success: false,
      message: 'description, venue, gameDate, and eventEndDate are required.',
    });
  }

  try {
    const game = await Game.create({
      description:  description.trim(),
      venue,
      gameDate:     new Date(gameDate),
      eventEndDate: new Date(eventEndDate),
      bannerImage:  req.file ? req.file.path : null,
    });

    return res.status(201).json({ success: true, data: game });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/games/:gameId/tickets
// Add one or more ticket types to an existing game.
// Body: single object { name, price, quantity } or an array of them.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/games/:gameId/tickets', async (req, res) => {
  const { gameId } = req.params;

  const types = Array.isArray(req.body) ? req.body : [req.body];

  for (const t of types) {
    if (!t.name || t.price == null || t.quantity == null) {
      return res.status(400).json({
        success: false,
        message: 'Each ticket type requires name, price, and quantity.',
      });
    }
    if (Number(t.price) < 0) {
      return res.status(400).json({ success: false, message: 'price must be 0 or greater.' });
    }
    if (!Number.isInteger(Number(t.quantity)) || Number(t.quantity) < 1) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer.' });
    }
    if (t.scope && !['day', 'all'].includes(t.scope)) {
      return res.status(400).json({ success: false, message: "scope must be 'day' or 'all'." });
    }
    if (t.ticketsPerPurchase != null && (!Number.isInteger(Number(t.ticketsPerPurchase)) || Number(t.ticketsPerPurchase) < 1)) {
      return res.status(400).json({ success: false, message: 'ticketsPerPurchase must be a positive integer.' });
    }
    if (t.serviceFee != null && Number(t.serviceFee) < 0) {
      return res.status(400).json({ success: false, message: 'serviceFee must be 0 or greater.' });
    }
  }

  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found.' });
    }

    const ticketTypes = await TicketType.insertMany(
      types.map((t) => ({
        gameId,
        name:               t.name,
        price:              Number(t.price),
        quantity:           Number(t.quantity),
        scope:              t.scope              ?? 'day',
        ticketsPerPurchase: Number(t.ticketsPerPurchase ?? 1),
        serviceFee:         Number(t.serviceFee ?? 0),
      }))
    );

    return res.status(201).json({ success: true, data: ticketTypes });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/games/:gameId/tickets
// All ticket types for a game, including inactive ones (admin view).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/games/:gameId/tickets', async (req, res) => {
  const { gameId } = req.params;
  try {
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found.' });
    const ticketTypes = await TicketType.find({ gameId });
    return res.json({ success: true, data: { ...game.toObject(), ticketTypes } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/games/:gameId/tickets/:ticketTypeId
// Update a ticket type's editable fields.
//
// Optimistic concurrency control via Mongoose's __v (version key):
//   • Client must supply the __v it last read.
//   • The update filter includes { __v: clientVersion } so it only succeeds
//     if no other write has incremented __v in the meantime.
//   • On match: fields are updated and __v is atomically incremented.
//   • On mismatch: findOneAndUpdate returns null → 409 conflict.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/games/:gameId/tickets/:ticketTypeId', async (req, res) => {
  const { gameId, ticketTypeId } = req.params;
  const { __v, name, price, quantity, scope, ticketsPerPurchase, serviceFee } = req.body;

  if (__v === undefined || __v === null) {
    return res.status(400).json({
      success: false,
      message: '__v (version) is required to prevent conflicting updates.',
    });
  }

  // ── Validate and build the $set payload ───────────────────────────────────
  const updates = {};

  if (name !== undefined) {
    if (!String(name).trim()) {
      return res.status(400).json({ success: false, message: 'name cannot be empty.' });
    }
    updates.name = String(name).trim();
  }
  if (price !== undefined) {
    if (Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'price must be 0 or greater.' });
    }
    updates.price = Number(price);
  }
  if (quantity !== undefined) {
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer.' });
    }
    updates.quantity = Number(quantity);
  }
  if (scope !== undefined) {
    if (!['day', 'all'].includes(scope)) {
      return res.status(400).json({ success: false, message: "scope must be 'day' or 'all'." });
    }
    updates.scope = scope;
  }
  if (ticketsPerPurchase !== undefined) {
    if (!Number.isInteger(Number(ticketsPerPurchase)) || Number(ticketsPerPurchase) < 1) {
      return res.status(400).json({ success: false, message: 'ticketsPerPurchase must be a positive integer.' });
    }
    updates.ticketsPerPurchase = Number(ticketsPerPurchase);
  }
  if (serviceFee !== undefined) {
    if (Number(serviceFee) < 0) {
      return res.status(400).json({ success: false, message: 'serviceFee must be 0 or greater.' });
    }
    updates.serviceFee = Number(serviceFee);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update.' });
  }

  try {
    // Guard: new quantity must not fall below tickets already sold.
    // sold is only incremented by payment webhooks, so this check is stable.
    if (updates.quantity !== undefined) {
      const current = await TicketType.findOne({ _id: ticketTypeId, gameId });
      if (!current) {
        return res.status(404).json({ success: false, message: 'Ticket type not found.' });
      }
      if (updates.quantity < current.sold) {
        return res.status(422).json({
          success: false,
          message: 'Cannot reduce ticket quantity below tickets already sold.',
        });
      }
    }

    // Atomic update: filter includes __v so any concurrent write invalidates this.
    // $inc: { __v: 1 } advances the version on success.
    const updated = await TicketType.findOneAndUpdate(
      { _id: ticketTypeId, gameId, __v: Number(__v) },
      { $set: updates, $inc: { __v: 1 } },
      { new: true }
    );

    if (!updated) {
      // Distinguish version conflict from a bad ID
      const exists = await TicketType.exists({ _id: ticketTypeId, gameId });
      if (!exists) {
        return res.status(404).json({ success: false, message: 'Ticket type not found.' });
      }
      return res.status(409).json({
        success: false,
        message: 'Ticket type was modified by another admin.',
      });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/games/:gameId/tickets/:ticketTypeId
// super_admin → hard delete (only if sold === 0)
// admin       → soft delete (sets active: false; allowed even if sold > 0)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/games/:gameId/tickets/:ticketTypeId', async (req, res) => {
  const { gameId, ticketTypeId } = req.params;
  const isSuperAdmin = req.admin.role === 'super_admin';
  try {
    const tt = await TicketType.findOne({ _id: ticketTypeId, gameId });
    if (!tt) {
      return res.status(404).json({ success: false, message: 'Ticket type not found.' });
    }

    if (isSuperAdmin && tt.sold === 0) {
      // Hard delete: super_admin only, and only when no tickets sold
      await tt.deleteOne();
      return res.json({ success: true, deleted: 'hard' });
    } else {
      // Soft delete: anyone can deactivate regardless of sold count
      tt.active = false;
      await tt.save();
      return res.json({ success: true, deleted: 'soft' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/games
// All games (past + upcoming) with a per-game sales summary.
// Summary is computed from TicketType documents in a single aggregate.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/games', async (req, res) => {
  try {
    const games = await Game.find().sort({ gameDate: 1 });

    if (games.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const gameIds = games.map((g) => g._id);

    // One aggregate across all ticket types: sum sold, capacity, revenue per game
    const summaryRows = await TicketType.aggregate([
      { $match: { gameId: { $in: gameIds } } },
      {
        $group: {
          _id:           '$gameId',
          totalCapacity: { $sum: '$quantity' },
          totalSold:     { $sum: '$sold' },
          totalRevenue:  { $sum: { $multiply: ['$sold', '$price'] } },
        },
      },
    ]);

    const summaryMap = new Map(summaryRows.map((s) => [s._id.toString(), s]));

    const data = games.map((game) => {
      const s = summaryMap.get(game._id.toString()) ?? {
        totalCapacity: 0,
        totalSold:     0,
        totalRevenue:  0,
      };

      return {
        ...game.toObject(),
        ticketsSold:      s.totalSold,
        ticketsRemaining: s.totalCapacity - s.totalSold,
        totalRevenue:     s.totalRevenue,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/games/:gameId
// Update game fields. Banner image replacement is optional.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/games/:gameId', (req, res, next) => {
  uploadBanner(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  const { gameId } = req.params;

  try {
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ success: false, message: 'Game not found.' });

    const { description, venue, gameDate, eventEndDate } = req.body;

    if (description !== undefined) game.description = description.trim();
    if (venue)        game.venue        = venue;
    if (gameDate)     game.gameDate     = new Date(gameDate);
    if (eventEndDate) game.eventEndDate = new Date(eventEndDate);
    if (req.file)     game.bannerImage  = req.file.path;

    await game.save();

    return res.json({ success: true, data: game });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/games/:gameId
// Remove a game, its ticket types, and any open reservations.
// Orders and Tickets are retained for audit purposes.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/games/:gameId', requireSuperAdmin, async (req, res) => {
  const { gameId } = req.params;

  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found.' });
    }

    await Promise.all([
      Game.findByIdAndDelete(gameId),
      TicketType.deleteMany({ gameId }),
      TicketReservation.deleteMany({ gameId }),
    ]);

    return res.json({
      success: true,
      message: `Game "${game.description}" and its ticket types have been deleted.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/orders
// List all paid orders, newest first. Supports ?gameId= filter.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const filter = { paymentStatus: 'paid' };
    if (req.query.gameId) filter.gameId = req.query.gameId;

    const orders = await Order.find(filter)
      .populate('gameId',      'description venue gameDate')
      .populate('ticketTypeId', 'name price')
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ success: true, data: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/reports/gate/:gameId
// Gate reconciliation report: sold vs scanned per game + per ticket type.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/gate/:gameId', async (req, res) => {
  try {
    const report = await generateGateReconciliationReport(req.params.gameId);
    return res.json({ success: true, data: report });
  } catch (err) {
    const status = err.statusCode ?? 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/reports/gate/:gameId/export
// Returns scan logs for a game as a CSV file attachment.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/reports/gate/:gameId/export', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const gid = new mongoose.Types.ObjectId(req.params.gameId);

    const logs = await ScanLog.find({ gameId: gid })
      .populate('ticketId',     'ticketId')
      .populate('ticketTypeId', 'name')
      .sort({ scanTime: 1 })
      .lean();

    const escapeCsv = (v) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = ['Ticket ID', 'Ticket Type', 'Scan Time', 'Scan Result', 'Gate Name', 'Scanner Device'];

    const rows = logs.map((log) => [
      log.rawTicketId ?? log.ticketId?.ticketId ?? '',
      log.ticketTypeId?.name ?? '',
      log.scanTime
        ? new Date(log.scanTime).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
        : '',
      log.scanResult,
      log.gateName        ?? '',
      log.scannerDeviceId ?? '',
    ].map(escapeCsv).join(','));

    const csv      = [headers.join(','), ...rows].join('\r\n');
    const date     = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const filename = `gate-scan-log-${req.params.gameId}-${date}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/report-recipients
// ─────────────────────────────────────────────────────────────────────────────
router.get('/report-recipients', async (_req, res) => {
  try {
    const recipients = await ReportRecipient.find().sort({ createdAt: 1 });
    return res.json({ success: true, data: recipients });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/report-recipients
// Body: { email, name?, active? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/report-recipients', async (req, res) => {
  const { email, name, active } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'email is required.' });
  }

  try {
    const recipient = await ReportRecipient.create({
      email,
      name:   name   ?? null,
      active: active ?? true,
    });
    return res.status(201).json({ success: true, data: recipient });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This email is already a recipient.' });
    }
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/report-recipients/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/report-recipients/:id', requireSuperAdmin, async (req, res) => {
  try {
    const recipient = await ReportRecipient.findByIdAndDelete(req.params.id);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found.' });
    }
    return res.json({
      success: true,
      message: `${recipient.email} has been removed from the report recipients.`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
  }
});

module.exports = router;
