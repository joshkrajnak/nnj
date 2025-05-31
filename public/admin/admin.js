// /public/admin/admin.js
import { renderBracket, wireBracketAdminEvents } from '../bracket.js';

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('admin-tournament-list');
  const detailEl = document.getElementById('admin-detail');
  const form = document.getElementById('new-tourney-form');
  const inputName = document.getElementById('new-tourney-name');
  const inputDesc = document.getElementById('new-tourney-description');
  const inputDate = document.getElementById('new-tourney-date');
  const logoutBtn = document.getElementById('logoutBtn');
  const snackbar = document.getElementById('admin-snackbar');

  function showSnackbar(msg) {
    snackbar.textContent = msg;
    snackbar.className = 'admin-snackbar show';
    setTimeout(() => snackbar.className = 'admin-snackbar', 2500);
  }

  async function loadTournaments() {
    const tours = await fetch('/api/tournaments', { credentials: "include" }).then(r => r.json());
    renderList(tours);
  }

  function renderList(tours) {
    listEl.innerHTML = tours.map(t => `
      <li class="admin-tourney-item">
        <b>${t.name}</b>
        <span class="admin-player-count">(${(t.players||[]).length} players)</span>
        <!--<span class="admin-player-count">${t.description ? '· ' + t.description : ''}</span>-->
        <span class="admin-player-count">${t.date ? '· ' + (new Date(t.date)).toLocaleDateString() : ''}</span>
        <button class="admin-btn" data-id="${t._id}" data-action="view">View</button>
        <button class="admin-btn" data-id="${t._id}" data-action="delete">Delete</button>
        <button class="admin-btn" data-id="${t._id}" data-action="init">Init Bracket</button>
      </li>
    `).join('');
  }

  listEl.onclick = async e => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'view') showDetail(id);
    if (action === 'delete' && confirm('Delete this tournament?')) {
      await fetch(`/api/tournaments/${id}`, { method: 'DELETE', credentials: "include" });
      await loadTournaments();
      detailEl.innerHTML = '';
      showSnackbar('Tournament deleted.');
    }
    if (action === 'init') {
      await fetch(`/api/tournaments/${id}/bracket/generate`, { method: 'POST', credentials: "include" });
      showDetail(id);
      showSnackbar('Bracket generated!');
    }
  };

  async function showDetail(id) {
    const t = await fetch(`/api/tournaments/${id}`, { credentials: "include" }).then(r => r.json());
    detailEl.innerHTML = `
      <div class="admin-detail-panel">
        <h3>
          <span class="admin-editable" id="editable-name">${t.name}</span>
        </h3>
        <div>
          <span class="admin-editable" id="editable-description">${t.description || "Add description..."}</span>
        </div>
        <div>
          <span class="admin-editable" id="editable-date">${t.date ? (new Date(t.date)).toLocaleDateString() : "Set date..."}</span>
        </div>
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
        <h4>Bracket</h4>
        <div id="admin-matches-container"></div>
      </div>
    `;
    document.getElementById('closeDetailBtn').onclick = () => (detailEl.innerHTML = '');

    // Editable fields (inline edit for name, desc, date)
    function makeEditable(id, field, isDate) {
      const el = document.getElementById(id);
      el.onclick = async () => {
        if (el.querySelector('input')) return;
        const oldValue = isDate ? (t[field] ? new Date(t[field]).toISOString().slice(0,10) : "") : t[field] || "";
        el.classList.add('admin-editing');
        el.innerHTML = `<input type="${isDate ? "date" : "text"}" value="${oldValue}" style="font-size:1em;">`;
        const input = el.querySelector('input');
        input.focus();
        input.onblur = async () => {
          const val = input.value.trim();
          el.classList.remove('admin-editing');
          if (isDate) {
            await fetch(`/api/tournaments/${t._id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: val ? new Date(val) : null }),
              credentials: "include"
            });
          } else {
            await fetch(`/api/tournaments/${t._id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [field]: val }),
              credentials: "include"
            });
          }
          showDetail(t._id);
          showSnackbar('Tournament updated.');
        };
        input.onkeydown = e => { if (e.key === 'Enter') input.blur(); };
      };
    }
    makeEditable("editable-name", "name");
    makeEditable("editable-description", "description");
    makeEditable("editable-date", "date", true);

    // Remove player
    detailEl.querySelectorAll('.remove-player-btn').forEach(btn => {
      btn.onclick = async e => {
        await fetch(`/api/tournaments/${btn.dataset.tid}/players/${btn.dataset.pid}`, { method: 'DELETE', credentials: "include" });
        showDetail(id);
        showSnackbar('Player removed.');
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
        }),
        credentials: "include"
      });
      showDetail(id);
      showSnackbar('Player added!');
    };

    // --- Render and wire up the bracket view ---
    const matchesContainer = document.getElementById('admin-matches-container');
    matchesContainer.innerHTML = renderBracket(t, { adminMode: true });

    wireBracketAdminEvents(matchesContainer, async (round, match, winnerId) => {
      await fetch(`/api/tournaments/${id}/match/${round}/${match}/set-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId }),
        credentials: "include"
      });
      showDetail(id);
      showSnackbar('Winner set!');
    });
  }

  // Create tournament
  form.onsubmit = async e => {
    e.preventDefault();
    await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: inputName.value,
        description: inputDesc.value,
        date: inputDate.value ? new Date(inputDate.value) : null
      }),
      credentials: "include"
    });
    inputName.value = '';
    inputDesc.value = '';
    inputDate.value = '';
    await loadTournaments();
    showSnackbar('Tournament created!');
  };

  // Logout
  logoutBtn.onclick = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: "include" });
    window.location = '/admin/login.html';
  };

  loadTournaments();
});
