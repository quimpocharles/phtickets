const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true, trim: true },
  monicker:  { type: String, default: null, trim: true },
  logo:      { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Team', teamSchema);
