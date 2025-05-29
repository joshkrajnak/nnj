// admin.js
const socket = io();
const list   = document.getElementById('admin-queue-list');

socket.on('queue-update', queue => {
  list.innerHTML = queue.map(u => `
    <li style="padding:8px;border-bottom:1px solid rgba(64,223,255,0.07);">
      <label style="color:#fff;font-weight:500;">
        <input type="checkbox" ${u.played?'checked':''}
               onchange="togglePlayed('${u.username}')" />
        ${u.username}
      </label>
      <button onclick="removeUser('${u.username}')" style="
        margin-left:12px;background:#fd3359;color:#fff;border:none;
        padding:4px 8px;font-size:0.9rem;border-radius:4px;cursor:pointer;
      ">Remove</button>
    </li>
  `).join('');
});

window.togglePlayed = username => {
  socket.emit('admin-mark-played', username);
};

window.removeUser = username => {
  if (confirm(`Remove ${username}?`)) {
    socket.emit('admin-remove', username);
  }
};
