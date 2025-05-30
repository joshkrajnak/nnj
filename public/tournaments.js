// public/tournaments.js

let currentTournamentId = null;

// Load tournaments and render the list
async function loadTournaments() {
  const res = await fetch('/api/tournaments');
  const tournaments = await res.json();
  renderList(tournaments);
}
function renderList(tours) {
  const listEl = document.getElementById('tournament-list');
  if (!tours.length) {
    listEl.innerHTML = '<li>No tournaments available.</li>';
    return;
  }
  listEl.innerHTML = tours.map(t => `
    <li>
      <b>${t.name}</b> (${(t.players||[]).length} players)
      <button onclick="openJoinForm('${t._id}')">Join</button>
    </li>
  `).join('');
}

// Modal logic
function openJoinForm(tournamentId) {
  currentTournamentId = tournamentId;
  const modal = document.getElementById('join-modal');
  if (modal) modal.style.display = 'flex';
}
function closeJoinForm() {
  const modal = document.getElementById('join-modal');
  if (modal) modal.style.display = 'none';
}

// Attach events after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  loadTournaments();

  // Attach join form submit event
  const joinForm = document.getElementById('join-form');
  joinForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentTournamentId) return;
    const fd = new FormData(joinForm);
    const data = {
      tiktokUsername: fd.get('tiktokUsername'),
      fortniteName: fd.get('fortniteName')
    };
    await fetch(`/api/tournaments/${currentTournamentId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    closeJoinForm();
    loadTournaments();
  };

  document.getElementById('close-join-modal').onclick = closeJoinForm;
});

// Make join function global for inline button
window.openJoinForm = openJoinForm;
