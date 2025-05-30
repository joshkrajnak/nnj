document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('admin-tournament-list');
  const detailEl = document.getElementById('admin-detail');
  const form = document.getElementById('new-tourney-form');
  const inputName = document.getElementById('new-tourney-name');
  const logoutBtn = document.getElementById('logoutBtn');

  // Fetch & render tournaments
  async function loadTournaments() {
    const tours = await fetch('/api/tournaments').then(r => r.json());
    renderList(tours);
  }

  function renderList(tours) {
    listEl.innerHTML = tours.map(t =>
      `<li class="admin-tourney-item">
        <b>${t.name}</b> <span class="admin-player-count">(${(t.players||[]).length} players)</span>
        <button class="admin-btn" data-id="${t._id}" data-action="view">View</button>
        <button class="admin-btn" data-id="${t._id}" data-action="delete">Delete</button>
        <button class="admin-btn" data-id="${t._id}" data-action="init">Init Bracket</button>
      </li>`
    ).join('');
  }

  // Delegate buttons in tourney list
  listEl.onclick = async e => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'view') showDetail(id);
    if (action === 'delete' && confirm('Delete this tournament?')) {
      await fetch(`/api/tournaments/${id}`, { method: 'DELETE' });
      await loadTournaments();
      detailEl.innerHTML = '';
    }
    if (action === 'init') {
      await fetch(`/api/tournaments/${id}/bracket/generate`, { method: 'POST' });
      showDetail(id);
    }
  };

  // View details for a tournament
  async function showDetail(id) {
    const t = await fetch(`/api/tournaments/${id}`).then(r => r.json());
    detailEl.innerHTML = `
      <div class="admin-detail-panel">
        <h3>${t.name}</h3>
        <button class="admin-btn" id="closeDetailBtn">Close</button>
        <h4>Players</h4>
        <ul class="admin-player-list">
          ${(t.players||[]).map(p => `
            <li>
              <b>${p.tiktokUsername || 'Unknown'}</b> <span>(${p.fortniteName || 'No Fortnite ID'})</span>
              <button class="admin-btn remove-player-btn" data-tid="${t._id}" data-pid="${p._id}">Remove</button>
            </li>
          `).join('')}
        </ul>
        <form class="admin-player-form" id="add-player-form">
          <input name="tiktokUsername" placeholder="TikTok Username" required>
          <input name="fortniteName" placeholder="Fortnite Name" required>
          <button class="admin-btn">Add</button>
        </form>
        <h4>Matches</h4>
        ${renderMatchesTable(t)}
        <h4>Set Winner (use Match Indices)</h4>
        <form id="set-winner-form" class="admin-set-winner-form">
          <input name="round" type="number" placeholder="Round #" required>
          <input name="match" type="number" placeholder="Match #" required>
          <input name="winnerId" placeholder="Winner Player ID" required>
          <button class="admin-btn">Set Winner</button>
        </form>
      </div>
    `;
    document.getElementById('closeDetailBtn').onclick = () => (detailEl.innerHTML = '');
    // Remove player
    detailEl.querySelectorAll('.remove-player-btn').forEach(btn => {
      btn.onclick = async e => {
        await fetch(`/api/tournaments/${btn.dataset.tid}/players/${btn.dataset.pid}`, { method: 'DELETE' });
        showDetail(id);
      };
    });
    // Add player
    detailEl.querySelector('#add-player-form').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await fetch(`/api/tournaments/${id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiktokUsername: fd.get('tiktokUsername'),
          fortniteName: fd.get('fortniteName')
        })
      });
      showDetail(id);
    };
    // Set winner
    detailEl.querySelector('#set-winner-form').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await fetch(`/api/tournaments/${id}/match/${fd.get('round')}/${fd.get('match')}/set-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId: fd.get('winnerId') })
      });
      showDetail(id);
    };
  }

  function renderMatchesTable(t) {
    if (!t.rounds || !t.rounds.length) return '<div>No bracket generated yet.</div>';
    function getPlayer(players, id) {
      return (players||[]).find(p => p._id === id) || {};
    }
    return `
      <table class="admin-matches-table">
        <thead>
          <tr><th>Round</th><th>Match</th><th>Player 1</th><th>Player 2</th><th>Winner</th></tr>
        </thead>
        <tbody>
        ${t.rounds.map((round, rdx) =>
          round.map((m, mdx) => `
            <tr>
              <td>${rdx}</td>
              <td>${mdx}</td>
              <td>${getPlayer(t.players, m.player1).tiktokUsername || '—'}</td>
              <td>${getPlayer(t.players, m.player2).tiktokUsername || '—'}</td>
              <td>${getPlayer(t.players, m.winner).tiktokUsername || '—'}</td>
            </tr>
          `).join('')
        ).join('')}
        </tbody>
      </table>
    `;
  }

  // Create tournament
  form.onsubmit = async e => {
    e.preventDefault();
    await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: inputName.value })
    });
    inputName.value = '';
    await loadTournaments();
  };

  // Logout
  logoutBtn.onclick = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location = '/login.html';
  };

  loadTournaments();
});
