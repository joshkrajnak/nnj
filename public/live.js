// public/live.js

window.addEventListener('unhandledrejection', event => {
  const err = event.reason;
  if (err && err.data?.method === 'PUBLIC_GetOneTapSettings') {
    event.preventDefault();
    return false;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  function safeRender(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // Renders the leaderboard using current session data (sessionLeaderboard)
  function renderSession(leaderboard) {
    const users = Object.entries(leaderboard)
      .map(([username, obj]) => ({
        username,
        nickname: (obj && obj.nickname) || username,
        likes: (obj && obj.count) || obj || 0
      }))
      .sort((a, b) => b.likes - a.likes);
if (users.length === 0) {
  safeRender('session-body', `<tr><td colspan="3">No likes yet. Be the first to tap ❤️!</td></tr>`);
  return;
}
    const rows = users.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${u.nickname} <span style="font-size:0.85em;color:#888;">@${u.username}</span></td>
        <td>${u.likes.toLocaleString()}</td>
      </tr>
    `).join('');
    safeRender('session-body', rows);
  }

  // Listen for live status and like count
  socket.on('liveStatus', ({ isLive, totalLikes }) => {
    const statusEl = document.getElementById('live-status');
    statusEl.innerHTML = `<span class="live-dot" style="background:${isLive ? 'red' : 'gray'}"></span> ${isLive ? 'LIVE' : 'Offline'}`;
    const likeEl = document.getElementById('likeCount');
    if (likeEl) likeEl.innerText = (totalLikes || 0).toLocaleString();
  });

  // Listen for session leaderboard (this is the live leaderboard)
  socket.on('sessionLeaderboard', leaderboard => {
    renderSession(leaderboard);
  });

  // Also handle per-like updates (optional, for snappy updates)
  socket.on('likeUpdate', (data) => {
    const likeEl = document.getElementById('likeCount');
    if (likeEl && typeof data.totalLikes === 'number')
      likeEl.innerText = data.totalLikes.toLocaleString();
  });

socket.on('sessionLeaderboard', leaderboard => {
  console.log('Received sessionLeaderboard:', leaderboard);
  renderSession(leaderboard);
});

  // Initial subscription to live session updates
  socket.emit('subscribe-live');
  window._liveSocket = socket;
});
