const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  venue: { type: String, required: true },
  gameDate: { type: Date, required: true },
  eventEndDate: { type: Date, required: true },
  bannerImage: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Game', gameSchema);
