const assert = require('assert');
const test = require('node:test');
const { generateSingleElimBracket } = require('../lib/bracket');

test('creates correct rounds for 4 players', () => {
  const players = [{_id:'a'}, {_id:'b'}, {_id:'c'}, {_id:'d'}];
  const rounds = generateSingleElimBracket(players);
  assert.strictEqual(rounds.length, 2);
  assert.strictEqual(rounds[0].length, 2);
  assert.strictEqual(rounds[1].length, 1);
});

test('handles odd player count', () => {
  const players = [{_id:'a'}, {_id:'b'}, {_id:'c'}, {_id:'d'}, {_id:'e'}];
  const rounds = generateSingleElimBracket(players);
  assert.strictEqual(rounds[0].length, 3);
  assert.strictEqual(rounds.length, 3);
});
