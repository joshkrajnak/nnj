// public/leaderboard.js

document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('leaderboard-body');

  // Helper to render leaderboard
  function renderLeaderboard(data) {
    const users = Object.entries(data)
      .map(([username, obj]) => ({
        username,
        nickname: (obj && obj.nickname) || username,
        likes: (obj && obj.count) || obj || 0
      }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 30);

    const rows = users.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${u.nickname} <span style="font-size:0.85em;color:#888;">@${u.username}</span></td>
        <td>${u.likes.toLocaleString()}</td>
      </tr>
    `).join('');
    if (tbody) tbody.innerHTML = rows;
  }

  // 1. Load initial data from API for F5/refresh
  fetch('/api/best-likes')
    .then(res => res.json())
    .then(data => renderLeaderboard(data));

  // 2. Listen for live updates via socket.io!
  const socket = io();
  socket.on('allTimeLeaderboard', leaderboard => {
    renderLeaderboard(leaderboard);
  });
});
