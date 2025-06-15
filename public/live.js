window.addEventListener('unhandledrejection', event => {
  const err = event.reason;
  if (err && err.data?.method === 'PUBLIC_GetOneTapSettings') {
    event.preventDefault();
    return false;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let previousLeaderboard = {};

  function safeRender(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function triggerRowEffect(username) {
  const tryRow = () => {
    const row = document.querySelector(`tr[data-user="${username}"]`);
    if (!row) return;

    row.classList.add('shake');
    setTimeout(() => row.classList.remove('shake'), 500);

    const sparkleContainer = document.createElement('div');
    sparkleContainer.className = 'sparkle-container';
    row.appendChild(sparkleContainer);

    for (let i = 0; i < 12; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.left = `${Math.random() * 100}%`;
      sparkle.style.top = `${Math.random() * 100}%`;
      sparkleContainer.appendChild(sparkle);
    }

    setTimeout(() => sparkleContainer.remove(), 600);
  };

  setTimeout(tryRow, 10); // delay lets DOM update before targeting
}

  function renderSession(leaderboard) {
    const users = Object.entries(leaderboard)
      .map(([username, obj]) => ({
        username,
        nickname: obj?.nickname || username,
        likes: obj?.count || 0
      }))
      .sort((a, b) => b.likes - a.likes);

    if (users.length === 0) {
      safeRender('session-body', `<tr><td colspan="3">No likes yet. Be the first to tap ❤️!</td></tr>`);
      return;
    }

    const rows = users.map((u, i) => {
      const isGold = u.likes >= 3000;
      const nicknameClass = isGold ? 'glow-row golden-user' : '';
      return `
        <tr data-user="${u.username}">
          <td>${i + 1}</td>
          <td class="${nicknameClass}">${u.nickname} - @${u.username}</td>
          <td>${u.likes.toLocaleString()}</td>
        </tr>
      `;
    }).join('');
    safeRender('session-body', rows);

    // Trigger sparkle for updated users
    Object.entries(leaderboard).forEach(([username, obj]) => {
      const prevCount = previousLeaderboard[username]?.count || 0;
      if (obj.count > prevCount) {
        triggerRowEffect(username);
      }
    });

    previousLeaderboard = leaderboard;
  }

  socket.on('liveStatus', ({ isLive, totalLikes }) => {
    const statusEl = document.getElementById('live-status');
    if (statusEl) {
      statusEl.innerHTML = `<span class="live-dot" style="background:${isLive ? 'red' : 'gray'}"></span> ${isLive ? 'LIVE' : 'Offline'}`;
    }
    const likeEl = document.getElementById('likeCount');
    if (likeEl) likeEl.innerText = (totalLikes || 0).toLocaleString();
  });

  socket.on('sessionLeaderboard', leaderboard => {
    console.log('Received sessionLeaderboard:', leaderboard);
    renderSession(leaderboard);
  });

  socket.on('likeUpdate', data => {
    const likeEl = document.getElementById('likeCount');
    if (likeEl && typeof data.totalLikes === 'number') {
      likeEl.innerText = data.totalLikes.toLocaleString();
    }
  });

  socket.emit('subscribe-live');
});
