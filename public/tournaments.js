// tournaments.js
const socket = io();

const listEl   = document.getElementById('tourney-list');
const detailEl = document.getElementById('tourney-detail');

// Only request the list once socket is connected
socket.on('connect', () => {
  socket.emit('get-tournaments');
});

// Render tournament list
function renderList(tours) {
  listEl.innerHTML = tours.map(t => `
    <div class="bg-white/10 p-4 rounded-lg flex justify-between items-center">
      <div>
        <h2 class="text-xl font-semibold text-white">${t.name}</h2>
        <p class="text-white/70">Status: ${t.status}</p>
      </div>
      <div>
        ${t.status === 'registration'
          ? `<button onclick="joinTourney('${t._id}')" class="join-btn">Join</button>`
          : ''}
        <button onclick="viewTourney('${t._id}')" class="join-btn">View</button>
      </div>
    </div>
  `).join('');

  listEl.classList.remove('hidden');
  detailEl.classList.add('hidden');
}

// Render tournament detail
function renderDetail(t) {
  let html = `
    <button onclick="resetView()" class="join-btn mb-4">&larr; Back</button>
    <h2 class="text-2xl font-bold text-white">${t.name}</h2>
    <p class="text-white/70">Status: ${t.status}</p>
  `;

  if (t.status === 'registration') {
    html += `
      <div class="mt-4">
        <input id="join-name" placeholder="Your TikTok username"
               class="p-2 rounded-md bg-white/20 text-white w-1/2 mr-2"/>
        <button onclick="joinTourney('${t._id}')" class="join-btn">
          Join Tournament
        </button>
      </div>
      <p class="text-white/60 mt-2">Entrants: ${t.entrants.length}</p>
    `;
  }

  if (t.status !== 'registration') {
    html += `<div class="mt-6">
      <h3 class="text-xl text-white font-semibold mb-2">Bracket</h3>
      ${renderBracket(t.bracket)}
    </div>`;
  }

  detailEl.innerHTML = html;
  listEl.classList.add('hidden');
  detailEl.classList.remove('hidden');
}

// Build bracket HTML
function renderBracket(bracket) {
  const byRound = bracket.reduce((acc, m) => {
    (acc[m.round] ||= []).push(m);
    return acc;
  }, {});

  return Object.keys(byRound).sort((a,b)=>a-b).map(round => `
    <div class="mb-6">
      <h4 class="text-white font-medium mb-2">Round ${round}</h4>
      ${byRound[round].map(m => `
        <div class="match flex justify-between items-center bg-white/10 p-3 rounded mb-2">
          <span>${m.player1 || '—'}</span>
          <span>vs</span>
          <span>${m.player2 || '—'}</span>
          ${m.winner
            ? `<strong class="text-[#40dfff]">Winner: ${m.winner}</strong>`
            : ''
          }
        </div>
      `).join('')}
    </div>
  `).join('');
}

// Back to list
window.resetView = () => {
  listEl.classList.remove('hidden');
  detailEl.classList.add('hidden');
};

// Join tournament
window.joinTourney = (id) => {
  const input = document.getElementById('join-name');
  const username = input
    ? input.value.trim()
    : prompt('Enter your TikTok username:');
  if (!username) return alert('Please enter your username');
  fetch(`/api/tournaments/${id}/join`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ username })
  })
  .then(res => res.json())
  .then(renderDetail)
  .catch(err => alert(err));
};

// View tournament detail
window.viewTourney = (id) => {
  socket.emit('subscribe-tournament', id);
};

// Socket.IO events
socket.on('tournaments-list', renderList);
socket.on('tournaments-update', () => socket.emit('get-tournaments'));
socket.on('tournament-detail', renderDetail);
