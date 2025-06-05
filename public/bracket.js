// /public/bracket.js
// Shared bracket rendering for admin & public views

export function renderBracket(tournament, opts = {}) {
  
  const { adminMode = false, onSetWinner = () => {} } = opts;
  if (!tournament.rounds || !tournament.rounds.length) {
    return `<div class="bracket-empty">No bracket generated yet.</div>`;
  }
  const players = tournament.players || [];
  // Helper to get player display name
  function pname(id) {
    const p = players.find(pl => pl._id === id);
    return p ? (p.tiktokUsername || p.fortniteName || "—") : "—";
  }
  function pavatar(id) {
    const p = players.find(pl => pl._id === id);
    return p && p.avatar ? `<img src="${p.avatar}" class="bracket-avatar">` : "";
  }

  // Render a round as columns of matches
  function renderRound(round, rdx) {
    return `
      <div class="bracket-round">
        <div class="bracket-round-title">Round ${rdx + 1}</div>
        ${round.map((match, mdx) => {
          const winner = match.winner;
          // Admin: clickable names to set winner
          const playerBtn = (pid, label) =>
            pid
              ? `<div class="bracket-player${winner === pid ? " winner" : ""}">
                  ${adminMode
                    ? `<a href="#" class="bracket-set-winner" data-round="${rdx}" data-match="${mdx}" data-pid="${pid}" style="color:${winner === pid ? '#7ee0ff' : '#ffe653'}">${pavatar(pid)}${label}</a>`
                    : `<span>${pavatar(pid)}${label}</span>`
                  }
                </div>`
              : `<div class="bracket-player empty">—</div>`;

          return `
            <div class="bracket-match" data-round="${rdx}" data-match="${mdx}">
              ${playerBtn(match.player1, pname(match.player1))}
              <div class="bracket-vs">vs</div>
              ${playerBtn(match.player2, pname(match.player2))}
              ${winner ? `<div class="bracket-winner-label">Winner: ${pname(winner)}</div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // Wrap rounds horizontally
  return `
    <div class="bracket-container${adminMode ? " bracket-admin" : ""}">
      ${tournament.rounds.map((round, rdx) => renderRound(round, rdx)).join("")}
    </div>
  `;
}

// Handler to wire up winner click events (call after .innerHTML render)
export function wireBracketAdminEvents(container, setWinnerFn) {
  container.querySelectorAll('.bracket-set-winner').forEach(link => {
    link.onclick = e => {
      e.preventDefault();
      const round = link.dataset.round;
      const match = link.dataset.match;
      const pid = link.dataset.pid;
      setWinnerFn(round, match, pid);
    };
  });
}
