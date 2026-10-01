import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, moreCards, DeckError, DECK_SIZE } from '../lib/deck.js';

// Fake Nova: hands out numbered concepts ("Thing 1", "Thing 2", ...) and remembers every request.
function fakePropose() {
  let next = 1;
  const calls = [];
  const propose = async request => {
    calls.push(request);
    return Array.from({ length: request.count }, () => {
      const n = next++;
      return { name: `Thing ${n}`, search: [`thing${n}`] };
    });
  };
  return { propose, calls };
}

const number = word => Number(word.replace('thing', ''));

// Fake ARASAAC: every word has one pictogram unless `missing(word)` says otherwise.
const fakeFind = (missing = () => false) => async words =>
  missing(words[0]) ? [] : [{ pictogramId: number(words[0]), image: `img/${words[0]}.png`, term: words[0], about: '' }];

test('builds 24 cards with unique pictograms and keeps the extras as spares', async () => {
  const { propose, calls } = fakePropose();
  const deck = await buildDeck({ topic: 'the solar system', language: 'Spanish' }, { propose, find: fakeFind() });
  assert.equal(deck.cards.length, DECK_SIZE);
  assert.equal(new Set(deck.cards.map(card => card.pictogramId)).size, DECK_SIZE);
  assert.ok(deck.spares.length > 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(deck.cards[0], { name: 'Thing 1', search: 'thing1', pictogramId: 1, image: 'img/thing1.png' });
});

test('drops concepts without a pictogram and repeated names or pictograms', async () => {
  const propose = async () => [
    { name: 'El Sol', search: ['sun'] },
    { name: 'el sol', search: ['sun'] }, // same name, different case
    { name: 'La Luna', search: ['moon'] },
    { name: 'Moonlight', search: ['moon'] }, // same pictogram as La Luna
    { name: 'Agujero negro', search: ['black hole'] }, // no pictogram
    ...Array.from({ length: 30 }, (_, i) => ({ name: `Planet ${i}`, search: [`planet${i}`] })),
  ];
  const ids = { sun: 1, moon: 2 };
  const find = async ([word]) => (word === 'black hole' ? [] : [{ pictogramId: ids[word] ?? word, image: `${word}.png`, term: word }]);
  const deck = await buildDeck({ topic: 'space', language: 'Spanish' }, { propose, find });
  const names = deck.cards.map(card => card.name);
  assert.deepEqual(names.slice(0, 3), ['El Sol', 'La Luna', 'Planet 0']);
  assert.ok(!names.includes('el sol') && !names.includes('Moonlight') && !names.includes('Agujero negro'));
});

test('asks once more, avoiding what it already tried, when the first round is short', async () => {
  const { propose, calls } = fakePropose();
  const find = fakeFind(word => number(word) <= 36 && number(word) % 2 === 0);
  const deck = await buildDeck({ topic: 'farm animals', language: 'English' }, { propose, find });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].avoid.length, 36);
  assert.ok(calls[1].avoid.includes('Thing 2'));
  assert.equal(deck.cards.length, DECK_SIZE);
});

test('applies the review: drops rejected cards, fixes names, and skips names that become repeats', async () => {
  const { propose } = fakePropose();
  const review = async ({ candidates }) =>
    candidates.map(candidate => {
      if (candidate.name === 'Thing 2') return { keep: false, name: candidate.name, picture: 1 }; // off topic
      if (candidate.name === 'Thing 3') return { keep: true, name: 'The Thing', picture: 1 }; // corrected title
      if (candidate.name === 'Thing 4') return { keep: true, name: 'the thing', picture: 1 }; // same as the corrected Thing 3
      if (candidate.name === 'Thing 5') return null; // no verdict: keep as is
      return { keep: true, name: candidate.name, picture: 1 };
    });
  const deck = await buildDeck({ topic: 'things', language: 'English' }, { propose, find: fakeFind(), review });
  const names = deck.cards.map(card => card.name);
  assert.deepEqual(names.slice(0, 4), ['Thing 1', 'The Thing', 'Thing 5', 'Thing 6']);
  assert.equal(deck.cards.length, DECK_SIZE);
});

test('uses the picture the review chose', async () => {
  const propose = async () => [
    { name: 'La Tierra', search: ['earth'] },
    ...Array.from({ length: 30 }, (_, i) => ({ name: `Planet ${i}`, search: [`planet${i}`] })),
  ];
  const find = async ([word]) =>
    word === 'earth'
      ? [
          { pictogramId: 3160, image: 'soil.png', term: 'earth', about: 'ground (agriculture)' },
          { pictogramId: 30014, image: 'planet-earth.png', term: 'earth', about: 'The Earth (astronomy)' },
        ]
      : [{ pictogramId: word, image: `${word}.png`, term: word, about: '' }];
  const review = async ({ candidates }) => candidates.map(candidate => ({ keep: true, name: candidate.name, picture: candidate.name === 'La Tierra' ? 2 : 1 }));
  const deck = await buildDeck({ topic: 'the solar system', language: 'Spanish' }, { propose, find, review });
  assert.deepEqual(deck.cards[0], { name: 'La Tierra', search: 'earth', pictogramId: 30014, image: 'planet-earth.png' });
});

test('keeps the cards when the review itself fails', async () => {
  const { propose } = fakePropose();
  const review = async () => {
    throw new Error('Amazon Nova answered 500');
  };
  const deck = await buildDeck({ topic: 'things', language: 'English' }, { propose, find: fakeFind(), review });
  assert.equal(deck.cards[0].name, 'Thing 1');
  assert.equal(deck.cards.length, DECK_SIZE);
});

test('skips a concept whose picture lookup fails, but reports a picture service that is down', async () => {
  const { propose } = fakePropose();
  const flaky = async words => {
    if (words[0] === 'thing3') throw new Error('ARASAAC answered 503');
    return fakeFind()(words);
  };
  const deck = await buildDeck({ topic: 'things', language: 'English' }, { propose, find: flaky });
  assert.ok(!deck.cards.some(card => card.name === 'Thing 3'));
  assert.equal(deck.cards.length, DECK_SIZE);

  const down = async () => {
    throw new Error('ARASAAC answered 503');
  };
  await assert.rejects(buildDeck({ topic: 'things', language: 'English' }, { propose, find: down }), /ARASAAC answered 503/);
});

test('says the topic is too narrow when three rounds are not enough', async () => {
  const { propose, calls } = fakePropose();
  const find = fakeFind(word => number(word) % 5 !== 0); // only 1 in 5 has a pictogram
  await assert.rejects(
    buildDeck({ topic: 'quantum chromodynamics', language: 'English' }, { propose, find }),
    error => error instanceof DeckError && error.code === 'too-narrow',
  );
  assert.equal(calls.length, 3);
});

test('more cards never repeat a name or pictogram the page has already seen', async () => {
  const calls = [];
  const propose = async request => {
    calls.push(request);
    return [
      { name: 'El Sol', search: ['sun'] }, // already a card
      { name: 'La Estrella', search: ['star'] }, // new name, but the same pictogram as a swapped-out card
      { name: 'El Cometa', search: ['comet'] },
      { name: 'El Cohete', search: ['rocket'] },
    ];
  };
  const ids = { sun: 1, star: 2, comet: 3, rocket: 4 };
  const find = async ([word]) => [{ pictogramId: ids[word], image: `${word}.png`, term: word, about: '' }];
  const existing = [
    { name: 'El Sol', pictogramId: 1 },
    { name: 'El Lucero', pictogramId: 2 },
  ];
  const cards = await moreCards({ topic: 'the solar system', language: 'Spanish', existing }, { propose, find });
  assert.deepEqual(cards.map(card => card.name), ['El Cometa', 'El Cohete']);
  assert.deepEqual(calls[0].avoid, ['El Sol', 'El Lucero']);
});

test('stops asking when the AI has no ideas at all for the topic', async () => {
  const calls = [];
  const propose = async request => {
    calls.push(request);
    return [];
  };
  await assert.rejects(
    buildDeck({ topic: 'zzzz qqqq', language: 'English' }, { propose, find: fakeFind() }),
    error => error instanceof DeckError && error.code === 'too-narrow',
  );
  assert.equal(calls.length, 1);
});
