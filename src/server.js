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

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    scheduleEodReport(); // start background cron after DB is ready
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
