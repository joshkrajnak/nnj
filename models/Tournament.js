// models/Tournament.js
const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['registration', 'in-progress', 'finished'],
    default: 'registration'
  },
  entrants: {
    type: [String],
    default: []
  },
  bracket: {
    type: [
      {
        matchId: Number,
        player1: String,
        player2: String,
        winner: String,
        round: Number
      }
    ],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', TournamentSchema);
