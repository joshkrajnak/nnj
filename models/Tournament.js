const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  tiktokId: String,
  tiktokUsername: String,
  avatar: String,
  fortniteName: String
}, { _id: true });

const MatchSchema = new mongoose.Schema({
  player1: { type: mongoose.Schema.Types.ObjectId, required: false },
  player2: { type: mongoose.Schema.Types.ObjectId, required: false },
  winner: { type: mongoose.Schema.Types.ObjectId, required: false },
  matchNumber: Number
}, { _id: false });

const TournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  state: { type: String, enum: ['pending', 'started', 'completed'], default: 'pending' },
  players: [PlayerSchema],
  rounds: [[MatchSchema]],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tournament', TournamentSchema);
