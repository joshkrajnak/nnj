// models/Tournament.js
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchId: Number,
  player1: String,
  player2: String,
  winner:  String,
  round:   Number
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  entrants: { type: [String], default: [] },
  bracket:  { type: [matchSchema], default: [] },
  status:   {
    type: String,
    enum: ['registration','in-progress','finished'],
    default: 'registration'
  }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);