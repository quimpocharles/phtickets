// v1.0.1
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { scheduleEodReport } = require('./jobs/eodReport');

const PORT = process.env.PORT || 3000;

// ── Global error handlers ─────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────

// ── Keep-alive ping (prevents Render free-tier spin-down) ────────────────────
function startKeepAlive() {
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (!selfUrl) return; // only runs on Render

  const INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
  setInterval(() => {
    fetch(`${selfUrl}/health`)
      .then(() => console.log('[keep-alive] ping ok'))
      .catch((err) => console.warn('[keep-alive] ping failed:', err.message));
  }, INTERVAL_MS);

  console.log(`[keep-alive] Pinging ${selfUrl}/health every 10 min`);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    scheduleEodReport(); // start background cron after DB is ready
    startKeepAlive();    // prevent Render spin-down
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
