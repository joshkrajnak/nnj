async function loadLeaderboard() {
  const res = await fetch('/api/best-likes');
  try {
    const data = await res.json();
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    const rows = Object.entries(data)
      .map(([username, bestLikes]) => ({ username, bestLikes }))
      .sort((a, b) => b.bestLikes - a.bestLikes)
      .slice(0, 30);
    rows.forEach((user, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${user.username}</td>
        <td>${user.bestLikes}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Leaderboard data is not valid JSON', e);
  }
}
loadLeaderboard();

// Optional: Live auto-update
if (typeof io !== "undefined") {
  const socket = io();
  socket.on('leaderboardUpdate', loadLeaderboard);
}
