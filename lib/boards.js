// Boards for the class: each board takes 12 different cards from the deck, laid out 4 × 3,
// and no two boards have the same set of cards. Pure functions, used by the PDF maker and the tests.

import { shuffle } from '../public/shuffle.js';

export { shuffle };
export const BOARD_SIZE = 12;
export const MAX_BOARDS = 60;

// → [{ number, cards: [12 cards] }]; a board whose set of cards was already used is drawn again.
export function makeBoards(cards, count, random = Math.random) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BOARDS) {
    throw new RangeError(`Choose between 1 and ${MAX_BOARDS} boards.`);
  }
  if (cards.length < BOARD_SIZE) throw new RangeError(`A board needs ${BOARD_SIZE} different cards.`);
  const boards = [];
  const used = new Set();
  for (let attempts = 0; boards.length < count; attempts++) {
    if (attempts > count * 100) throw new Error('Could not make that many different boards.');
    const picked = shuffle(cards, random).slice(0, BOARD_SIZE);
    const set = picked.map(card => String(card.pictogramId)).sort().join(',');
    if (used.has(set)) continue;
    used.add(set);
    boards.push({ number: boards.length + 1, cards: picked });
  }
  return boards;
}
