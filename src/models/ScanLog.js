const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema({
  // Populated for VALID and ALREADY_USED scans. Null for INVALID (ticket not found).
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    default: null,
  },
  // Raw string scanned from the QR code — always present regardless of scan result.
  rawTicketId: {
    type: String,
    default: null,
    trim: true,
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null,
  },
  ticketTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketType',
    default: null,
  },
  scanTime: {
    type: Date,
    default: Date.now,
  },
  scanResult: {
    type: String,
    enum: ['VALID', 'ALREADY_USED', 'INVALID'],
    required: true,
  },
  gateName: {
    type: String,
    default: null,
    trim: true,
  },
  scannerDeviceId: {
    type: String,
    default: null,
    trim: true,
  },
});

scanLogSchema.index({ ticketId: 1 });
scanLogSchema.index({ gameId: 1 });

module.exports = mongoose.model('ScanLog', scanLogSchema);
