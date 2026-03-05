const mongoose = require('mongoose');

const reportRecipientSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  name:      { type: String, default: null, trim: true },
  active:    { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ReportRecipient', reportRecipientSchema);
