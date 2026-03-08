const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const gamesRouter    = require('./routes/games');
const adminRouter    = require('./routes/admin');
const ticketsRouter  = require('./routes/tickets');
const paymentsRouter = require('./routes/payments');

const app = express();

// Trust the first proxy (required on Render / any reverse-proxy host)
app.set('trust proxy', 1);

// ── Security headers (helmet) ─────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGIN can be a comma-separated list of origins, or * for all.
const rawOrigin = process.env.ALLOWED_ORIGIN || '*';
const allowedOrigins = rawOrigin === '*' ? '*' : rawOrigin.split(',').map((o) => o.trim());
app.use(cors({
  origin: allowedOrigins === '*'
    ? '*'
    : (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const purchaseLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const findLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many lookup requests. Please try again later.' },
});

app.use(express.json());

// Apply rate limits before route handlers
app.use('/tickets/purchase', purchaseLimit);
app.use('/tickets/find',     findLimit);

app.use('/games', gamesRouter);
app.use('/admin', adminRouter);
app.use('/tickets', ticketsRouter);
app.use('/payments', paymentsRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message });
});

module.exports = app;
