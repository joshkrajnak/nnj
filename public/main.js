// public/main.js
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Helper: safe setter
  function safeRender(id, rowsHtml) {
    const el = document.getElementById(id);
    if (!el) {
      // console.warn(`Element #${id} not found; skipping render.`);
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

  // If you ever add an all-time section here, you can do:
  // function renderAllTime(list) { … safeRender('all-time-body', …) }

  socket.on('live-stats', list => {
    renderSession(list);
  });

  // Optionally emit a request to get the latest on connect
  socket.emit('subscribe-live');
});
