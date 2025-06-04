function generateSingleElimBracket(players) {
  const pLen = players.length;
  let rounds = [];
  let numMatches = Math.ceil(pLen / 2);
  let matches = [];
  for (let i = 0; i < numMatches; i++) {
    matches.push({
      player1: players[i * 2]?._id || null,
      player2: players[i * 2 + 1]?._id || null,
      winner: null,
      matchNumber: i
    });
  }
  rounds.push(matches);
  let currNumMatches = numMatches;
  while (currNumMatches > 1) {
    currNumMatches = Math.ceil(currNumMatches / 2);
    let nextRound = [];
    for (let i = 0; i < currNumMatches; i++) {
      nextRound.push({
        player1: null,
        player2: null,
        winner: null,
        matchNumber: i
      });
    }
    rounds.push(nextRound);
  }
  return rounds;
}

module.exports = { generateSingleElimBracket };
