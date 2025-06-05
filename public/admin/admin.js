// /public/admin/admin.js
import { renderBracket, wireBracketAdminEvents } from '../bracket.js';

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('admin-tournament-list');
  const form = document.getElementById('new-tourney-form');
  const inputName = document.getElementById('new-tourney-name');
  const inputDesc = document.getElementById('new-tourney-description');
  const inputDate = document.getElementById('new-tourney-date');
  const logoutBtn = document.getElementById('logoutBtn');
  const toggle = document.getElementById('live-toggle');
  const label = document.getElementById('live-status-label');
  const resetBtn = document.getElementById('reset-live-stats');

  function setLiveUI(isLive) {
    toggle.checked = isLive;
    label.textContent = isLive ? 'Live' : 'Offline';
    label.style.color = isLive ? '#00c853' : '#d11a2a';
  }

  if (toggle) {
    fetch('/api/live-status', { credentials: 'include' })
      .then(r => r.json())
      .then(({ isLive }) => setLiveUI(isLive));

    toggle.addEventListener('change', async () => {
      const newState = toggle.checked;
      const res = await fetch('/api/admin/set-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLive: newState }),
        credentials: 'include'
      });

      if (!res.ok) {
        alert("Failed to update live status.");
        toggle.checked = !newState;
      } else {
        setLiveUI(newState);
      }
    });
  }

  if (resetBtn) {
    resetBtn.onclick = async () => {
      if (!confirm("Are you sure you want to reset all live stats?")) return;

      const res = await fetch('/api/admin/reset-live', {
        method: 'POST',
        credentials: 'include'
      });

      alert(res.ok ? "✅ Live stats have been reset." : "❌ Failed to reset live stats.");
    };
  }

  async function loadTournaments() {
    const tours = await fetch('/api/tournaments', { credentials: "include" }).then(r => r.json());
    renderList(tours);
  }

  function renderList(tours) {
    listEl.innerHTML = tours.map(t => `
      <li class="admin-tourney-item" data-id="${t._id}">
        
      <div class="tourney-info">
        <b>${t.name}</b>
        <span class="admin-player-count">(${(t.players || []).length} players)</span>
        <span class="admin-player-count">${t.date ? '· ' + (new Date(t.date)).toLocaleDateString() : ''}</span>
      </div>
       </div>
          <div class="tourney-actions">
        <button class="admin-btn" data-id="${t._id}" data-action="view">View</button>
        <button class="admin-btn" data-id="${t._id}" data-action="delete">Delete</button>
        <button class="admin-btn" data-id="${t._id}" data-action="init">Init Bracket</button>
      </div>
        <div class="admin-tourney-detail hidden"></div>
      </li>
    `).join('');
  }




  listEl.onclick = async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const li = btn.closest('li.admin-tourney-item');
    const id = li.dataset.id;
    const action = btn.dataset.action;
    const detailEl = li.querySelector('.admin-tourney-detail');

    if (action === 'view') {
      const isVisible = !detailEl.classList.contains('hidden');
      if (isVisible) {
        detailEl.classList.add('hidden');
        detailEl.innerHTML = '';
      } else {
        const t = await fetch(`/api/tournaments/${id}`, { credentials: "include" }).then(r => r.json());
        detailEl.innerHTML = renderDetail(t);
        detailEl.classList.remove('hidden');
        wireDetailHandlers(detailEl, t);
      }
    }

    if (action === 'delete' && confirm('Delete this tournament?')) {
      await fetch(`/api/tournaments/${id}`, { method: 'DELETE', credentials: "include" });
      loadTournaments();
    }

    if (action === 'init') {
      await fetch(`/api/tournaments/${id}/bracket/generate`, { method: 'POST', credentials: "include" });
      const t = await fetch(`/api/tournaments/${id}`, { credentials: "include" }).then(r => r.json());
      detailEl.innerHTML = renderDetail(t);
      wireDetailHandlers(detailEl, t);
    }
  };

  function renderDetail(t) {
    return `
      <div class="admin-detail-panel">
        <h3><span class="admin-editable" id="editable-name">${t.name}</span></h3>
        <div><span class="admin-editable" id="editable-description">${t.description || "Add description..."}</span></div>
        <div><span class="admin-editable" id="editable-date">${t.date ? (new Date(t.date)).toLocaleDateString() : "Set date..."}</span></div>
        <h4>Players</h4>
        <ul class="admin-player-list">
          ${(t.players || []).map(p => `
            <li>
              <button class="admin-btn remove-player-btn" data-tid="${t._id}" data-pid="${p._id}">Remove</button>
              <b>${p.tiktokUsername || 'Unknown'}</b> <span>(${p.fortniteName || 'No Fortnite ID'})</span>
            </li>
          `).join('')}
        </ul>
        <form class="admin-player-form" id="add-player-form-${t._id}">
          <input name="tiktokUsername" placeholder="TikTok Username" required>
          <input name="fortniteName" placeholder="Fortnite Name" required>
          <button class="admin-btn">Add</button>
        </form>
        <h4>Bracket</h4>
        <div id="admin-matches-${t._id}"></div>
      </div>
    `;
  }

  function wireDetailHandlers(container, t) {
    const form = container.querySelector(`#add-player-form-${t._id}`);
    const matchesContainer = container.querySelector(`#admin-matches-${t._id}`);

    function makeEditable(id, field, isDate) {
      const el = container.querySelector(`#${id}`);
      el.onclick = () => {
        if (el.querySelector('input')) return;
        const val = isDate ? (t[field] ? new Date(t[field]).toISOString().slice(0, 10) : "") : t[field] || "";
        el.innerHTML = `<input type="${isDate ? "date" : "text"}" value="${val}" style="font-size:1em;">`;
        const input = el.querySelector('input');
        input.focus();
        input.onblur = async () => {
          const newVal = input.value.trim();
          await fetch(`/api/tournaments/${t._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: isDate ? new Date(newVal) : newVal }),
            credentials: "include"
          });
          const updated = await fetch(`/api/tournaments/${t._id}`, { credentials: "include" }).then(r => r.json());
          container.innerHTML = renderDetail(updated);
          wireDetailHandlers(container, updated);
        };
      };
    }

    makeEditable("editable-name", "name");
    makeEditable("editable-description", "description");
    makeEditable("editable-date", "date", true);

    container.querySelectorAll('.remove-player-btn').forEach(btn => {
      btn.onclick = async () => {
        await fetch(`/api/tournaments/${btn.dataset.tid}/players/${btn.dataset.pid}`, { method: 'DELETE', credentials: "include" });
        const updated = await fetch(`/api/tournaments/${t._id}`, { credentials: "include" }).then(r => r.json());
        container.innerHTML = renderDetail(updated);
        wireDetailHandlers(container, updated);
      };
    });

    form.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await fetch(`/api/tournaments/${t._id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiktokUsername: fd.get('tiktokUsername'),
          fortniteName: fd.get('fortniteName'),
          tosAgree: true,
          tosTimestamp: new Date(),
          tosVersion: '2024.06.01'
        }),
        credentials: "include"
      });
      const updated = await fetch(`/api/tournaments/${t._id}`, { credentials: "include" }).then(r => r.json());
      container.innerHTML = renderDetail(updated);
      wireDetailHandlers(container, updated);
    };

    matchesContainer.innerHTML = renderBracket(t, { adminMode: true });
    wireBracketAdminEvents(matchesContainer, async (round, match, winnerId) => {
      await fetch(`/api/tournaments/${t._id}/match/${round}/${match}/set-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId }),
        credentials: "include"
      });
      const updated = await fetch(`/api/tournaments/${t._id}`, { credentials: "include" }).then(r => r.json());
      container.innerHTML = renderDetail(updated);
      wireDetailHandlers(container, updated);
    });
  }

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
    loadTournaments();
  };

  logoutBtn.onclick = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: "include" });
    window.location = '/admin/index.html';
  };

  loadTournaments();
});