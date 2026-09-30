import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBoards, shuffle, BOARD_SIZE, MAX_BOARDS } from '../public/boards.js';

const deck = Array.from({ length: 24 }, (_, i) => ({ name: `Card ${i}`, pictogramId: 1000 + i }));
const setOf = board => board.cards.map(card => card.pictogramId).sort((a, b) => a - b).join(',');

// A repeatable "random" source, so a failing test can be replayed.
function seeded(seed) {
  let state = seed;
  return () => ((state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

test('makes exactly the boards asked for, numbered from 1', () => {
  const boards = makeBoards(deck, 30);
  assert.equal(boards.length, 30);
  assert.deepEqual(boards.map(board => board.number), Array.from({ length: 30 }, (_, i) => i + 1));
});

test('every board has 12 different cards from the deck', () => {
  for (const board of makeBoards(deck, MAX_BOARDS)) {
    assert.equal(board.cards.length, BOARD_SIZE);
    assert.equal(new Set(board.cards.map(card => card.pictogramId)).size, BOARD_SIZE);
    assert.ok(board.cards.every(card => deck.includes(card)));
  }
});

test('no two boards have the same set of cards, even when the random source repeats itself', () => {
  const varied = seeded(7);
  let calls = 0;
  const stuckAtFirst = () => (calls++ < 23 * 3 ? 0.5 : varied()); // the first three shuffles come out identical
  const boards = makeBoards(deck, 5, stuckAtFirst);
  assert.equal(new Set(boards.map(setOf)).size, 5);
  assert.equal(new Set(makeBoards(deck, MAX_BOARDS, seeded(42)).map(setOf)).size, MAX_BOARDS);
});

test('refuses counts outside 1–60 and decks too small for a board', () => {
  assert.throws(() => makeBoards(deck, 0), RangeError);
  assert.throws(() => makeBoards(deck, MAX_BOARDS + 1), RangeError);
  assert.throws(() => makeBoards(deck, 2.5), RangeError);
  assert.throws(() => makeBoards(deck.slice(0, 11), 1), RangeError);
});

test('shuffle keeps every card once and leaves the original order alone', () => {
  const original = [...deck];
  const shuffled = shuffle(deck, seeded(3));
  assert.deepEqual([...shuffled].sort((a, b) => a.pictogramId - b.pictogramId), original);
  assert.notDeepEqual(shuffled, original);
  assert.deepEqual(deck, original);
});
