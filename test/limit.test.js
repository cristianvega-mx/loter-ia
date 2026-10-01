import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter, LimitError } from '../lib/limit.js';

test('allows requests up to the daily limit and refuses the next one', () => {
  const count = createLimiter({ decks: 2 }, () => new Date('2026-10-05T10:00:00Z'));
  count('decks');
  count('decks');
  assert.throws(() => count('decks'), LimitError);
});

test('keeps a separate count for each kind of request', () => {
  const count = createLimiter({ decks: 1, more: 2 }, () => new Date('2026-10-05T10:00:00Z'));
  count('decks');
  count('more');
  count('more');
  assert.throws(() => count('decks'), LimitError);
  assert.throws(() => count('more'), LimitError);
});

test('starts over when the day changes', () => {
  let now = new Date('2026-10-05T23:59:00Z');
  const count = createLimiter({ decks: 1 }, () => now);
  count('decks');
  assert.throws(() => count('decks'), LimitError);
  now = new Date('2026-10-06T00:01:00Z');
  count('decks');
});
