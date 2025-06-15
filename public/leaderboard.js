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
      const rows = users.map((u, i) => {
        const isTop = i === 0;
        const crown = isTop ? ' 👑' : '';
        return `
          <tr class="${isTop ? 'glow-row golden-leader' : ''}">
             <td>${i + 1}${crown}</td>
            <td>${u.nickname} - @${u.username}</td>
            <td>${u.likes.toLocaleString()}</td>
          </tr>
        `;
      }).join('');
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
