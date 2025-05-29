// public/main.js

// === Suppress TikTok One‑Tap RPC failures ===
window.addEventListener('unhandledrejection', event => {
  const err = event.reason;
  if (err && err.data?.method === 'PUBLIC_GetOneTapSettings') {
    console.debug('Ignored TikTok one‑tap error:', err.message);
    event.preventDefault();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Helper: safe setter
  function safeRender(id, rowsHtml) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`Element #${id} not found; skipping render.`);
      return;
    }
    el.innerHTML = rowsHtml;
  }

  // Render session leaderboard
  function renderSession(list) {
    const rows = list.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${u.username}</td>
        <td>${u.likes.toLocaleString()}</td>
      </tr>
    `).join('');
    safeRender('session-body', rows);
  }

  // Listen for live stats updates
  socket.on('live-stats', list => {
    renderSession(list);
  });

  // Ensure we subscribe on connect
  socket.emit('subscribe-live');
});
