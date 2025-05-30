// server.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const http = require('http');
const session = require('express-session');
const { Server } = require('socket.io');
const Tournament = require('./models/Tournament');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// --- Admin Middleware ---
function isAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// --- Admin Auth APIs ---
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get('/api/admin/check', (req, res) => {
  if (req.session && req.session.isAdmin) return res.json({ ok: true });
  res.status(401).json({ error: 'Unauthorized' });
});

// --- Public Leaderboard API ---
app.get('/api/best-likes', (req, res) => {
  const jsonPath = path.join(__dirname, 'best-likes.json');
  if (fs.existsSync(jsonPath)) {
    res.sendFile(jsonPath);
  } else {
    res.json([]);
  }
});

// --- Tournament APIs ---
// Public: view tournaments and players
app.get('/api/tournaments', async (req, res) => {
  const tournaments = await Tournament.find();
  res.json(tournaments);
});
app.get('/api/tournaments/:id', async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  res.json(t);
});

// Admin: manage tournaments
app.post('/api/tournaments', isAdmin, async (req, res) => {
  try {
    const tournament = new Tournament({ name: req.body.name });
    await tournament.save();
    res.json(tournament);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.put('/api/tournaments/:id', isAdmin, async (req, res) => {
  try {
    const t = await Tournament.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.json(t);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.delete('/api/tournaments/:id', isAdmin, async (req, res) => {
  await Tournament.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});
app.delete('/api/tournaments/:id/players/:playerId', isAdmin, async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  tournament.players = tournament.players.filter(
    p => p._id.toString() !== req.params.playerId
  );
  await tournament.save();
  res.json(tournament);
});
app.put('/api/tournaments/:id/players/:playerId', isAdmin, async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  const idx = tournament.players.findIndex(p => p._id.toString() === req.params.playerId);
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });
  Object.assign(tournament.players[idx], req.body);
  await tournament.save();
  res.json(tournament.players[idx]);
});
app.post('/api/tournaments/:id/bracket/generate', isAdmin, async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  tournament.rounds = generateSingleElimBracket(tournament.players);
  await tournament.save();
  res.json(tournament.rounds);
});
app.post('/api/tournaments/:id/match/:round/:match/set-winner', isAdmin, async (req, res) => {
  const { id, round, match } = req.params;
  const { winnerId } = req.body;
  const tournament = await Tournament.findById(id);
  tournament.rounds[round][match].winner = winnerId;
  const roundIdx = parseInt(round, 10);
  const matchIdx = parseInt(match, 10);
  if (tournament.rounds[roundIdx + 1]) {
    const nextMatchIdx = Math.floor(matchIdx / 2);
    const pos = matchIdx % 2 === 0 ? 'player1' : 'player2';
    tournament.rounds[roundIdx + 1][nextMatchIdx][pos] = winnerId;
  }
  await tournament.save();
  res.json(tournament.rounds);
});

// Player registration (public, no admin needed)
app.post('/api/tournaments/:id/players', async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  tournament.players.push(req.body);
  await tournament.save();
  res.json(tournament);
});

// --- Helper for bracket ---
function generateSingleElimBracket(players) {
  const pLen = players.length;
  let rounds = [];
  let numMatches = Math.ceil(pLen / 2);
  let matches = [];
  for (let i = 0; i < numMatches; i++) {
    matches.push({
      player1: players[i * 2]?._id || null,
      player2: players[i * 2 + 1]?._id || null,
      winner: null,
      matchNumber: i
    });
  }
  rounds.push(matches);
  let currNumMatches = numMatches;
  while (currNumMatches > 1) {
    currNumMatches = Math.ceil(currNumMatches / 2);
    let nextRound = [];
    for (let i = 0; i < currNumMatches; i++) {
      nextRound.push({
        player1: null,
        player2: null,
        winner: null,
        matchNumber: i
      });
    }
    rounds.push(nextRound);
  }
  return rounds;
}

// --- Socket.IO (future use) ---
io.on('connection', (socket) => {
  console.log('A user connected');
});

// --- DB & SERVER ---
const PORT = process.env.PORT || 3000;
mongoose.connect('mongodb://localhost:27017/nnj')
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  }).catch(err => {
    console.error('MongoDB connection error:', err);
  });
