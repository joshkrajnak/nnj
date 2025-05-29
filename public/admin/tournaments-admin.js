// public/admin/tournaments-admin.js
document.addEventListener('DOMContentLoaded', () => {
  const selectEl = document.getElementById('tourney-select');
  const partInput = document.getElementById('new-participant');
  const addBtn = document.getElementById('add-participant-btn');
  const partList = document.getElementById('participant-list');
  const genBtn = document.getElementById('generate-bracket-btn');
  const roundsContainer = document.getElementById('rounds-container');
  const advanceBtn = document.getElementById('advance-btn');

  let tournaments = [];
  let current = null;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast show';
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  async function loadTournaments() {
    const res = await fetch('/api/tournaments');
    tournaments = await res.json();
    selectEl.innerHTML = tournaments
      .map(t => `<option value="${t._id}">${t.name} (${t.status})</option>`)
      .join('');
    if (tournaments.length) selectEl.value = tournaments[0]._id;
    selectEl.dispatchEvent(new Event('change'));
  }

  async function loadTournament(id) {
    const res = await fetch(`/api/tournaments/${id}`);
    current = await res.json();
    renderParticipants();
    renderBracket();
  }

  function renderParticipants() {
    partList.innerHTML = current.participants
      .map(u => `<li>${u}</li>`).join('');
  }

  addBtn.addEventListener('click', async () => {
    const username = partInput.value.trim();
    if (!username) return toast('Enter a username');
    await fetch(`/api/tournaments/${current._id}/participants`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username })
    });
    partInput.value = '';
    await loadTournament(current._id);
    toast('Participant added');
  });

  genBtn.addEventListener('click', async () => {
    if (!confirm('Generate bracket? This can only be done once.')) return;
    await fetch(`/api/tournaments/${current._id}/generate`, { method: 'POST' });
    await loadTournament(current._id);
    toast('Bracket generated');
  });

  function renderBracket() {
    roundsContainer.innerHTML = '';
    if (!current.rounds || !current.rounds.length) return;
    current.rounds.forEach((round, rIdx) => {
      const sec = document.createElement('section');
      sec.innerHTML = `<h3>${round.name}</h3>`;
      round.matches.forEach((m, mIdx) => {
        const div = document.createElement('div');
        div.className = 'form-row';
        const p1 = m.player1 || '—';
        const p2 = m.player2 || '—';
        const w = m.winner;
        div.innerHTML = `
          <span>${p1} vs ${p2}</span>
          ${w
            ? `<strong>Winner: ${w}</strong>`
            : `<button data-r="${rIdx}" data-m="${mIdx}">Mark Winner</button>`
          }
        `;
        if (!w) {
          div.querySelector('button').addEventListener('click', () => {
            const winner = window.prompt(`Winner (${p1} or ${p2})?`);
            markWinner(rIdx, mIdx, winner);
          });
        }
        sec.appendChild(div);
      });
      roundsContainer.appendChild(sec);
    });
  }

  async function markWinner(rIdx, mIdx, winner) {
    if (!winner) return;
    await fetch(`/api/tournaments/${current._id}/rounds/${rIdx}/matches/${mIdx}/winner`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ winner: winner.trim() })
    });
    await loadTournament(current._id);
    toast('Winner recorded');
  }

  advanceBtn.addEventListener('click', async () => {
    await fetch(`/api/tournaments/${current._id}/advance`, { method: 'POST' });
    await loadTournament(current._id);
    toast('Advanced round or finished');
  });

  selectEl.addEventListener('change', () => loadTournament(selectEl.value));

  loadTournaments();
});
