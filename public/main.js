// main.js
const socket    = io();
const statsBody = document.getElementById('stats-body');
const queueList = document.getElementById('queue-list');

// When socket connects, start getting live data
socket.on('connect', () => {
  socket.emit('subscribe-live');  // if you have a room; if not, server already pushes
});

// Render the live-stats table
socket.on('live-stats', list => {
  statsBody.innerHTML = list.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${u.username}</td>
      <td class="text-right">${u.likes.toLocaleString()}</td>
    </tr>
  `).join('');
});

// Render the live queue
socket.on('queue-update', queue => {
  queueList.innerHTML = queue.map(u => `
    <li class="flex justify-between bg-white/10 p-3 rounded">
      <span>${u.username}</span>
      <span>${u.played ? '✔️' : '⏳'}</span>
    </li>
  `).join('');
});

// Join the queue (asks for TikTok name)
function joinQueue() {
  const user = prompt('Enter your TikTok username:');
  if (user) socket.emit('join-queue', user.trim());
}
