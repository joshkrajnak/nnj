// server.js
require('dotenv').config();
const fs                 = require('fs');
const path               = require('path');
const express            = require('express');
const http               = require('http');
const basicAuth          = require('express-basic-auth');
const mongoose           = require('mongoose');
const bodyParser         = require('body-parser');
const { Server }         = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const Tournament         = require('./models/Tournament');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const PORT       = process.env.PORT || 3010;
const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017/notnotjosh';
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('❌ Missing ADMIN_USER or ADMIN_PASS in .env');
  process.exit(1);
}

// ————————————————————————————————————————
// All‑time likes persistence
// ————————————————————————————————————————
const BEST_FILE = path.join(__dirname, 'best-likes.json');
let bestLikes = {};
try {
  bestLikes = JSON.parse(fs.readFileSync(BEST_FILE, 'utf8'));
  console.log('✔ Loaded best-likes.json');
} catch {
  console.log('⚠ Starting with empty best-likes');
  bestLikes = {};
}

function saveBestLikes() {
  fs.writeFileSync(BEST_FILE, JSON.stringify(bestLikes, null, 2));
}

function getAllTimeLeaderboard() {
  return Object.entries(bestLikes)
    .map(([username, likes]) => ({ username, likes }))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 30);
}

// ————————————————————————————————————————
// MongoDB connection
// ————————————————————————————————————————
mongoose.connect(MONGO_URI)
  .then(() => console.log('✔ MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ————————————————————————————————————————
// Middleware
// ————————————————————————————————————————
app.use(bodyParser.json());

// ————————————————————————————————————————
// HTTP Basic Auth for /admin
// ————————————————————————————————————————
app.use(
  '/admin',
  basicAuth({
    users: { [ADMIN_USER]: ADMIN_PASS },
    challenge: true,
    realm: 'NotNotJosh Admin Area',
  }),
  express.static(path.join(__dirname, 'public', 'admin'))
);

// ————————————————————————————————————————
// Serve public files
// ————————————————————————————————————————
app.use(express.static(path.join(__dirname, 'public')));

// ————————————————————————————————————————
// Tournament REST API
// ————————————————————————————————————————

// List all tournaments
app.get('/api/tournaments', async (req, res) => {
  const tours = await Tournament.find().sort({ createdAt: -1 });
  res.json(tours);
});

// Get one tournament
app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const t = await Tournament.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch {
    res.status(400).json({ error: 'Invalid ID' });
  }
});

// Create a new tournament
app.post('/api/tournaments', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send('Missing name');
  const t = await Tournament.create({ name });
  io.emit('tournaments-update');
  res.status(201).json(t);
});

// Join a tournament
app.post('/api/tournaments/:id/join', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).send('Missing username');
  const t = await Tournament.findById(req.params.id);
  if (!t) return res.status(404).send('Not found');
  if (t.status !== 'registration') return res.status(400).send('Closed');
  if (!t.entrants.includes(username)) {
    t.entrants.push(username);
    await t.save();
    io.emit('tournament-update', t);
    io.emit('tournaments-update');
  }
  res.json(t);
});

// Start tournament (build bracket)
app.post('/api/tournaments/:id/start', async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) return res.status(404).send('Not found');
  if (t.status !== 'registration') return res.status(400).send('Already started');
  let entrants = [...t.entrants];
  if (!entrants.length) return res.status(400).send('No entrants');
  if (entrants.length % 2) entrants.push('');
  entrants.sort(() => Math.random() - 0.5);

  const bracket = [];
  for (let i = 0; i < entrants.length; i += 2) {
    bracket.push({
      matchId: i / 2,
      player1: entrants[i],
      player2: entrants[i + 1],
      winner: '',
      round: 1
    });
  }
  t.bracket = bracket;
  t.status  = 'in-progress';
  await t.save();
  io.emit('tournament-update', t);
  io.emit('tournaments-update');
  res.json(t);
});

// Record match winner & advance
app.post('/api/tournaments/:id/match/:matchId', async (req, res) => {
  const { winner } = req.body;
  if (!winner) return res.status(400).send('Missing winner');
  const t = await Tournament.findById(req.params.id);
  if (!t) return res.status(404).send('Not found');
  if (t.status !== 'in-progress') return res.status(400).send('Not in progress');

  const mId = Number(req.params.matchId);
  const match = t.bracket.find(m => m.matchId === mId && !m.winner);
  if (!match) return res.status(400).send('Invalid match');

  match.winner = winner;

  // Advance to next round
  const nextRound = match.round + 1;
  const offset    = t.entrants.length / Math.pow(2, nextRound);
  const nextId    = Math.floor(mId / 2) + offset;
  let nextMatch  = t.bracket.find(m => m.round === nextRound && m.matchId === nextId);
  if (!nextMatch) {
    nextMatch = { matchId: nextId, player1: '', player2: '', winner: '', round: nextRound };
    t.bracket.push(nextMatch);
  }
  if (mId % 2 === 0) nextMatch.player1 = winner;
  else               nextMatch.player2 = winner;

  const maxRounds = Math.log2(t.entrants.length);
  if (nextRound > maxRounds) t.status = 'finished';

  await t.save();
  io.emit('tournament-update', t);
  io.emit('tournaments-update');
  res.json(t);
});

// ————————————————————————————————————————
// TikTok Live‑Stats & Queue
// ————————————————————————————————————————
const tiktokUsername = 'notnotjosh_';
let users = {}, live = false, queue = [];
let connection = null;

async function connectToTikTok() {
  connection = new WebcastPushConnection(tiktokUsername);
  try {
    await connection.connect();
    live = true; io.emit('live-status', true);
    console.log(`🟢 Connected to TikTok LIVE as @${tiktokUsername}`);
    setupTikTokListeners();
  } catch {
    live = false; io.emit('live-status', false);
    console.log('⚠ Not live—retrying in 60s');
    setTimeout(connectToTikTok, 60000);
  }
}

function setupTikTokListeners() {
  connection.on('like', data => {
    console.log('[TikTok Like] raw data:', data);
    const username = data.uniqueId?.trim() || `user_${data.userId||'unknown'}`;
    const count    = typeof data.likeCount === 'number' && data.likeCount > 0
                     ? data.likeCount : 1;
    users[username] = (users[username]||0) + count;

    // Persist all‑time
    if (users[username] > (bestLikes[username]||0)) {
      bestLikes[username] = users[username];
      saveBestLikes();
      io.emit('all-time-leaderboard', getAllTimeLeaderboard());
    }

    io.emit('live-stats', getSessionLeaderboard());
  });

  connection.on('streamStart', () => {
    live = true; io.emit('live-status', true);
    console.log('🔵 Stream started');
  });
  connection.on('streamEnd', () => {
    live = false; io.emit('live-status', false);
    console.log('🔴 Stream ended — clearing session');
    users = {};
    setTimeout(connectToTikTok, 60000);
  });
}

function getSessionLeaderboard() {
  return Object.entries(users)
    .map(([username, likes]) => ({ username, likes }))
    .sort((a, b) => b.likes - a.likes);
}

// start the first connection attempt
connectToTikTok();

// periodic emit in case nothing changes
setInterval(() => {
  io.emit('live-status', live);
  io.emit('live-stats', getSessionLeaderboard());
}, 2000);

// ————————————————————————————————————————
// Socket.IO real‑time handlers
// ————————————————————————————————————————
io.on('connection', socket => {
  // All‑time top 30
  socket.emit('all-time-leaderboard', getAllTimeLeaderboard());
  socket.on('request-all-time-leaderboard', () => {
    socket.emit('all-time-leaderboard', getAllTimeLeaderboard());
  });

  // Live stats & queue
  socket.emit('live-status', live);
  socket.emit('live-stats', getSessionLeaderboard());
  socket.emit('queue-update', queue);
  socket.on('subscribe-live', () => {
    socket.emit('live-status', live);
    socket.emit('live-stats', getSessionLeaderboard());
    socket.emit('queue-update', queue);
  });

  // Queue actions
  socket.on('join-queue', username => {
    if (!queue.some(u => u.username === username)) {
      queue.push({ username, played: false, joinedAt: Date.now() });
      io.emit('queue-update', queue);
    }
  });
  socket.on('admin-mark-played', username => {
    queue = queue.map(u => u.username === username ? { ...u, played: true } : u);
    io.emit('queue-update', queue);
  });
  socket.on('admin-remove', username => {
    queue = queue.filter(u => u.username !== username);
    io.emit('queue-update', queue);
  });

  // Tournament subscriptions
  socket.on('get-tournaments', async () => {
    const tours = await Tournament.find().sort({ createdAt: -1 });
    socket.emit('tournaments-list', tours);
  });
  socket.on('subscribe-tournament', async id => {
    const t = await Tournament.findById(id);
    socket.emit('tournament-detail', t);
  });
});

// ————————————————————————————————————————
// Start HTTP server
// ————————————————————————————————————————
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
