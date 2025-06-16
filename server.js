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
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || 'notnotjosh_';

const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);


let isLive = false;
let totalLikes = 0;
let sessionLeaderboard = {};
let allTimeLeaderboard = {};



const bestLikesPath = path.join(__dirname, 'best-likes.json');

if (fs.existsSync(bestLikesPath)) {
  allTimeLeaderboard = JSON.parse(fs.readFileSync(bestLikesPath, 'utf-8'));
}
function saveLeaderboardToFile() {
  fs.writeFileSync(bestLikesPath, JSON.stringify(allTimeLeaderboard, null, 2), 'utf-8');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'super-secret-key', // Replace in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true in production if using HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

function isAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/admin/reset-live', isAdmin, (req, res) => {
  isLive = false;
  totalLikes = 0;
  sessionLeaderboard = {};
  io.emit('live-reset');
  res.sendStatus(200);
});

app.get('/api/live-status', (req, res) => {
  res.json({ isLive });
});

app.post('/api/admin/set-live', (req, res) => {
  const { isLive: newState } = req.body;
  isLive = !!newState;

  // ⬇️ Reset session stats if going offline
  if (!isLive) {
    totalLikes = 0;
    sessionLeaderboard = {};
    io.emit('sessionLeaderboard', sessionLeaderboard);
  }

  io.emit('liveStatus', { isLive, totalLikes });

  res.json({ success: true, isLive });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});
app.post('/api/admin/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/admin/check', (req, res) => {
  if (req.session?.isAdmin) return res.json({ ok: true });
  res.status(401).json({ error: 'Unauthorized' });
});
app.get('/api/best-likes', (req, res) => res.json(allTimeLeaderboard));


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
    const { name, description, date } = req.body;
    const tournament = new Tournament({ name, description, date });
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
  try {
    const { tiktokUsername, fortniteName } = req.body;

    if (!tiktokUsername || !fortniteName) {
      return res.status(400).json({ error: 'Missing player info' });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Construct player object to match schema
    const newPlayer = {
      tiktokUsername,
      fortniteName,
      tosAgree: true,
      tosTimestamp: new Date(),
      tosVersion: '2024.06.01'
    };

    tournament.players.push(newPlayer);
    await tournament.save();

    res.json(tournament);
  } catch (err) {
    console.error('Add player error:', err);
    res.status(500).json({ error: 'Server error' });
  }
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

// --- TikTok Webcast Listener ---
const { WebcastPushConnection } = require('tiktok-live-connector');
let likeCounts = {};

const tiktokLive = new WebcastPushConnection(TIKTOK_USERNAME);

tiktokLive.connect().then(state => {
  isLive = true;
  totalLikes = 0;
  sessionLeaderboard = {};
  console.log(`✅ Connected to roomId ${state.roomId}`);
  io.emit('liveStatus', { isLive, totalLikes });
}).catch(err => {
  console.error("❌ Failed to connect:", err);
});

tiktokLive.on('like', data => {
  const user = data.uniqueId || 'Anonymous';
  const nickname = data.nickname || user;
  const count = data.likeCount || 1;

  if (!sessionLeaderboard[user]) sessionLeaderboard[user] = { count: 0, nickname };
  sessionLeaderboard[user].count += count;
  sessionLeaderboard[user].nickname = nickname;

  if (!allTimeLeaderboard[user]) allTimeLeaderboard[user] = { count: 0, nickname };
  allTimeLeaderboard[user].count += count;
  allTimeLeaderboard[user].nickname = nickname;

  totalLikes += count;
  saveLeaderboardToFile();

  console.log(`❤️ ${nickname} liked ${count} times`);

  io.emit('likeUpdate', { totalLikes, username: user, nickname, likes: sessionLeaderboard[user].count });
  io.emit('sessionLeaderboard', sessionLeaderboard);
  io.emit('allTimeLeaderboard', allTimeLeaderboard);
});

tiktokLive.on('streamEnd', () => {
  isLive = false;
  totalLikes = 0;
  sessionLeaderboard = {};
  console.log('⚪ TikTok stream ended.');
  io.emit('liveStatus', { isLive, totalLikes });
  io.emit('sessionLeaderboard', sessionLeaderboard);
});

tiktokLive.on('streamEnd', () => {
  isLive = false;
  totalLikes = 0;
  sessionLeaderboard = {};
  console.log('⚪ TikTok stream ended.');

  io.emit('liveStatus', { isLive, totalLikes });
  io.emit('sessionLeaderboard', sessionLeaderboard); // also reset leaderboard client-side
});

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.emit('liveStatus', { isLive, totalLikes });
  socket.emit('sessionLeaderboard', sessionLeaderboard);
  socket.emit('allTimeLeaderboard', allTimeLeaderboard);

  socket.on('sendLike', (data) => {
    const user = data.username || 'Anonymous';
    const nickname = data.nickname || user;

    if (!allTimeLeaderboard[user]) allTimeLeaderboard[user] = { count: 0, nickname };
    allTimeLeaderboard[user].count += 1;
    allTimeLeaderboard[user].nickname = nickname;

    if (!sessionLeaderboard[user]) sessionLeaderboard[user] = { count: 0, nickname };
    sessionLeaderboard[user].count += 1;
    sessionLeaderboard[user].nickname = nickname;

    totalLikes += 1;
    saveLeaderboardToFile();

    io.emit('likeUpdate', { totalLikes, username: user, nickname, likes: sessionLeaderboard[user].count });
    io.emit('sessionLeaderboard', sessionLeaderboard);
    io.emit('allTimeLeaderboard', allTimeLeaderboard);
  });

  socket.on('subscribe-live', () => {
    socket.emit('liveStatus', { isLive, totalLikes });
    socket.emit('sessionLeaderboard', sessionLeaderboard);
    socket.emit('allTimeLeaderboard', allTimeLeaderboard);
  });
});
app.get('/api/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(req.session.user);
});

// --- MongoDB + Server Start ---
const PORT = process.env.PORT || 3000;
mongoose.connect('mongodb://localhost:27017/nnj')
  .then(() => {
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));