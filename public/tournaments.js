// tournament.js
document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('tourney-list');
  const joinModal = document.getElementById('join-modal');
  const closeModalBtn = document.getElementById('close-modal');
  const joinForm = document.getElementById('join-form');
  const tiktokUsernameInput = document.getElementById('tiktok-username');
  const userBar = document.getElementById('user-bar');
  let tournaments = [], expandedId = null, joiningId = null, user = null;

  // Check login status and get TikTok user info
  async function fetchUser() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // Fetch tournaments and user, then render
  async function initialize() {
    user = await fetchUser();
    tournaments = await fetch('/api/tournaments', { credentials: 'include' }).then(r => r.json());
    renderUserBar();
    renderTournaments();
  }

  function renderUserBar() {
    if (!user) {
      userBar.innerHTML = `
        <!--<a href="/auth/tiktok" class="tourney-join-btn" style="font-size:1em; margin-top:5px;">Click here to register</a>-->
        <!--<a href="" class="tourney-join-btn" style="font-size:1em; margin-top:5px;">Click here to register</a>-->
        <button onclick="window.location.href='/auth/tiktok'" class="tourney-join-btn" style="font-size:1em; margin-top:5px;"><img src="/images/tiktok-icon-2.svg" alt="TikTok" class="footer-icon" />Login with TikTok</button>
      `;
    } else {
      userBar.innerHTML = `
        <span style="color:#ffe653;font-weight:600;vertical-align:middle;">
          <img src="${user.avatar_url || ''}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:5px;">
          ${user.username || user.display_name || 'TikTokUser'}
        </span>
        <a href="/logout" class="footer-link" style="margin-left:12px;">Logout</a>
      `;
    }
  }

  function renderTournaments() {
    const reversed = tournaments.slice().reverse();
    listEl.innerHTML = reversed.map(t => `
      <div class="tourney-card">
        <div class="tourney-title" data-id="${t._id}">
          ${t.name}
          <span class="expand-arrow ${expandedId === t._id ? 'expanded' : ''}">▶</span>
        </div>
        <div class="tourney-meta">${(t.players||[]).length} players${t.description ? " · " + t.description : ""}</div>
        <div class="tourney-details" style="display:${expandedId===t._id?'block':'none'};">
          <div class="bracket-container">
            ${t.rounds && t.rounds.length 
              ? renderVisualBracket(t) 
              : '<em>Bracket not initialized yet.</em>'}
          </div>
          ${
            t.rounds && t.rounds.length
              ? `<span class="tourney-badge">Registration closed</span>`
              : user
                ? `<button class="tourney-join-btn" data-id="${t._id}">Join</button>`
                : `<div style="margin:1em 0;color:#ffe653;">Login with TikTok to join</div>`
          }
        </div>
      </div>
    `).join('');
    attachHandlers(reversed);
  }

  function attachHandlers(tourneys) {
    // Toggle expand/collapse
    listEl.querySelectorAll('.tourney-title').forEach((el, idx) => {
      const t = tourneys[idx];
      el.onclick = () => {
        expandedId = expandedId === t._id ? null : t._id;
        renderTournaments();
      };
    });
    // Join buttons
    listEl.querySelectorAll('.tourney-join-btn').forEach((btn, idx) => {
      const t = tourneys[idx];
      btn.onclick = () => {
        joiningId = t._id;
        // Autofill TikTok username and show modal
        tiktokUsernameInput.value = user?.username || user?.display_name || "TikTokUser";
        joinModal.style.display = 'flex';
      };
    });
  }

  closeModalBtn.onclick = () => {
    joinModal.style.display = 'none';
    joiningId = null;
    joinForm.reset();
  };
  window.onclick = (event) => {
    if (event.target === joinModal) closeModalBtn.onclick();
  };

  joinForm.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(joinForm);
    const fortniteName = fd.get('fortnite');
    try {
      const res = await fetch(`/api/tournaments/${joiningId}/players`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fortniteName })
      });
      if (res.ok) {
        alert('You have joined the tournament!');
        joinModal.style.display = 'none';
        joiningId = null;
        joinForm.reset();
        tournaments = await fetch('/api/tournaments', { credentials: 'include' }).then(r => r.json());
        renderTournaments();
      } else {
        const data = await res.json();
        alert(data.error || 'Could not join tournament.');
      }
    } catch {
      alert('Could not join tournament.');
    }
  };

  // Renders the bracket as a horizontal “tree”:
  function renderVisualBracket(t) {
    if (!t.rounds || !t.rounds.length) return '<div>No bracket generated yet.</div>';
    // Each t.rounds[i] is an array of matches for round i
    let roundsHtml = t.rounds.map((roundMatches, rdx) => {
      return `
        <div class="bracket-round">
          <div class="round-label">Round ${rdx + 1}</div>
          ${roundMatches.map(match => {
            const p1 = (t.players || []).find(p => p._id === match.player1);
            const p2 = (t.players || []).find(p => p._id === match.player2);
            const winnerId = match.winner;
            return `
  <div class="bracket-match">
    <div class="bracket-player${winnerId === (p1 && p1._id) ? ' winner' : ''}">
      ${p1 ? (p1.tiktokUsername || '—') : '—'}
    </div>
    <div class="bracket-vs">vs</div>
    <div class="bracket-player${winnerId === (p2 && p2._id) ? ' winner' : ''}">
      ${p2 ? (p2.tiktokUsername || '—') : '—'}
    </div>
    ${
      winnerId
        ? `<div class="bracket-winner-label">Winner: ${
            (p1 && p1._id === winnerId && p1.tiktokUsername) ||
            (p2 && p2._id === winnerId && p2.tiktokUsername) ||
            '—'
          }</div>`
        : ''
    }
  </div>
`;
          }).join('')}
        </div>
      `;
    }).join('');
    return `<div class="bracket-tree">${roundsHtml}</div>`;
  }

  initialize();
});