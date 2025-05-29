// tournaments-admin.js
const socket = io();
const listEl = document.getElementById('admin-list');
const form   = document.getElementById('new-tourney-form');
const input  = document.getElementById('new-name');

// Render the admin list of tournaments
function renderAdminList(tours) {
  listEl.innerHTML = tours.map(t => `
    <div class="bg-white/10 p-4 rounded-lg flex justify-between items-center">
      <div>
        <h2 class="text-xl font-semibold text-white">${t.name}</h2>
        <p class="text-white/70">Status: ${t.status}</p>
      </div>
      <div class="flex gap-2">
        ${t.status === 'registration'
          ? `<button onclick="startTourney('${t._id}')" class="join-btn">Start</button>`
          : ''
        }
        <button onclick="viewAdmin('${t._id}')" class="join-btn">View</button>
      </div>
    </div>
  `).join('');
}

// Create new tournament handler
form.addEventListener('submit', e => {
  e.preventDefault();
  const name = input.value.trim();
  if (!name) return alert('Enter a tournament name');
  fetch('/api/tournaments', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ name })
  }).then(() => {
    input.value = '';
    socket.emit('get-tournaments');
  });
});

// Start tournament on the server
window.startTourney = id => {
  fetch(`/api/tournaments/${id}/start`, { method:'POST' })
    .then(() => socket.emit('get-tournaments'));
};

// View tournament detail in the public page (opens in new tab)
window.viewAdmin = id => {
  window.open(`/tournaments.html?id=${id}`, '_blank');
};

// Socket.IO events
socket.on('connect', () => socket.emit('get-tournaments'));
socket.on('tournaments-list', renderAdminList);
socket.on('tournaments-update', () => socket.emit('get-tournaments'));
