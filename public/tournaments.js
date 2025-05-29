// public/tournaments.js
const socket      = io();
const listEl      = document.getElementById('tournament-list');
const form        = document.getElementById('new-tourney-form');
const inputName   = document.getElementById('new-tourney-name');
const container   = document.getElementById('tourney-container');
const backBtn     = document.getElementById('back-btn');
const actionBtn   = document.getElementById('tourney-action');
const matchInfo   = document.getElementById('match-info');
const bracketEl   = document.getElementById('bracket-container');
let currentTourney = null;

// Toggle views
function showDetail(show) {
  listEl.classList.toggle('hidden', show);
  form.classList.toggle('hidden', show);
  container.classList.toggle('hidden', !show);
}

//--- LIST RENDERING ---

function renderList(tours) {
  if (!tours.length) {
    listEl.innerHTML = '<li>No tournaments found.</li>';
    return;
  }
  listEl.innerHTML = tours
    .map(t => `<li><a href="#" data-id="${t._id}">${t.name}</a></li>`)
    .join('');
  listEl.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      socket.emit('subscribe-tournament', a.dataset.id);
    });
  });
}

//--- DETAIL & BRACKET ---

function renderDetail(t) {
  currentTourney = t;
  document.getElementById('tourney-name').textContent = t.name;
  showDetail(true);
  renderControls(t);
  renderBracket(t.bracket || []);
}

function renderControls(t) {
  if (t.status === 'registration') {
    matchInfo.textContent = 'Entrants: ' + (t.entrants||[]).join(', ');
    actionBtn.textContent = 'Start Tournament';
    actionBtn.disabled = false;
    actionBtn.onclick = startTournament;
  }
  else if (t.status === 'in-progress') {
    const m = t.bracket.find(m=>!m.winner);
    matchInfo.innerHTML = m
      ? `Round ${m.round}, Match ${m.matchId}: <strong>${m.player1}</strong> vs <strong>${m.player2}</strong>`
      : 'All matches complete.';
    actionBtn.textContent = m ? 'Mark Winner' : 'Finished';
    actionBtn.disabled = !m;
    if (m) actionBtn.onclick = ()=>markWinner(m.matchId,m.player1,m.player2);
  }
  else {
    const champ = t.bracket.slice(-1)[0]?.winner||'Unknown';
    matchInfo.textContent = `🏆 Champion: ${champ}`;
    actionBtn.textContent = 'Finished';
    actionBtn.disabled = true;
  }
}

// Simple bracket: group by rounds
function renderBracket(matches) {
  bracketEl.innerHTML = '';
  if (!matches.length) return;
  const rounds = {};
  matches.forEach(m=>{
    if (!rounds[m.round]) rounds[m.round]=[];
    rounds[m.round].push(m);
  });
  const maxRound = Math.max(...Object.keys(rounds).map(n=>+n));
  for (let r=1; r<=maxRound; r++) {
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '1rem';
    col.innerHTML = `<h3 style="text-align:center">Round ${r}</h3>` +
      rounds[r].map(m=>{
        const p1 = m.player1||'<em>—</em>';
        const p2 = m.player2||'<em>—</em>';
        return `<div style="background:rgba(255,255,255,0.1);padding:0.5rem;border-radius:6px;">
          ${p1} <span style="opacity:0.6">vs</span> ${p2}<br>
          <small>Winner: ${m.winner||'<em>—</em>'}</small>
        </div>`;
      }).join('');
    bracketEl.appendChild(col);
  }
}

//--- API ACTIONS ---

async function startTournament() {
  try {
    const res = await fetch(`/api/tournaments/${currentTourney._id}/start`, {
      method:'POST', headers:{'Content-Type':'application/json'}
    });
    if (!res.ok) throw new Error(await res.text());
    renderDetail(await res.json());
  } catch(err){ alert('Error: '+err.message); }
}

async function markWinner(matchId,p1,p2) {
  const winner=prompt(`Who won? Enter exactly "${p1}" or "${p2}"`);
  if (!winner) return;
  try {
    const res = await fetch(
      `/api/tournaments/${currentTourney._id}/match/${matchId}`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ winner })
    });
    if (!res.ok) throw new Error(await res.text());
    renderDetail(await res.json());
  } catch(err){ alert('Error: '+err.message); }
}

//--- CREATE NEW ---

form.addEventListener('submit', async e=>{
  e.preventDefault();
  const name = inputName.value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/tournaments', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(await res.text());
    inputName.value = '';
    socket.emit('get-tournaments'); // refresh
  } catch(err){ alert('Error creating: '+err.message); }
});

//--- SOCKET HANDLERS & INIT ---

socket.on('tournaments-update', ()=> socket.emit('get-tournaments'));
socket.on('tournaments-list', renderList);
socket.on('tournament-detail', renderDetail);

backBtn.onclick = ()=> showDetail(false);

socket.emit('get-tournaments');
showDetail(false);
