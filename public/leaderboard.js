// public/leaderboard.js
console.log('leaderboard.js loaded, connecting socket…');
const socket = io();

// Shared render function
function renderAllTime(list) {
  console.log('Rendering all‑time leaderboard:', list);
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return console.error('Missing <tbody id="leaderboard-body">');
  tbody.innerHTML = list.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${u.username}</td>
      <td>${u.likes.toLocaleString()}</td>
    </tr>
  `).join('');
}

// 1️⃣ Fetch persisted data on page load
fetch('/best-likes.json')
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(data => renderAllTime(data))
  .catch(err => console.error('Failed to load all‑time leaderboard:', err));

// 2️⃣ Listen for live updates
socket.on('all-time-leaderboard', list => {
  console.log('Socket all-time-leaderboard event:', list);
  renderAllTime(list);
});
