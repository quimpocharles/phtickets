const mongoose = require('mongoose');

// One document per calendar day (PHT). Used to detect missed EOD sends.
const ReportLogSchema = new mongoose.Schema({
  reportDate:     { type: String, required: true, unique: true }, // 'YYYY-MM-DD' PHT
  sentAt:         { type: Date, default: Date.now },
  recipientCount: { type: Number, default: 0 },
  orderCount:     { type: Number, default: 0 },
  revenue:        { type: Number, default: 0 },
});

module.exports = mongoose.model('ReportLog', ReportLogSchema);
