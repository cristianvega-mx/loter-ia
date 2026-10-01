import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browsePictograms, findPictograms, imageUrl } from '../lib/arasaac.js';

// Fake fetch that answers by URL and records what was asked.
function fakeFetch(answers) {
  const asked = [];
  const fetch = async url => {
    asked.push(url.replace('https://api.arasaac.org/v1/pictograms/en/', ''));
    const answer = answers[asked.at(-1)];
    if (answer === undefined) return new Response('[]', { status: 404 });
    if (typeof answer === 'number') return new Response('error', { status: answer });
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  return { fetch, asked };
}

const pictogram = (id, ...keywords) => ({ _id: id, keywords: keywords.map(keyword => ({ keyword })) });
const ids = options => options.map(option => option.pictogramId);

test('uses the exact-match search first', async () => {
  const { fetch, asked } = fakeFetch({ 'bestsearch/comet': [pictogram(2711, 'comet')] });
  assert.deepEqual(await findPictograms(['comet'], { fetch }), [{ pictogramId: 2711, image: imageUrl(2711), term: 'comet', keyword: 'comet', about: 'comet', shelves: [] }]);
  assert.deepEqual(asked, ['bestsearch/comet']);
});

test('browses a shelf of the library: its pictures, titled with their first keyword', async () => {
  const comet = { _id: 2711, keywords: [{ keyword: 'comet' }], categories: ['astronomy'], tags: ['astronomy', 'core vocabulary'] };
  const classroom = { _id: 9001, keywords: [{ keyword: 'classroom' }], categories: ['school'], tags: ['space'] }; // found by its tag, but on another shelf
  const phrase = { _id: 9002, keywords: [{ keyword: 'is it a star?' }], categories: ['astronomy'] };
  const scary = { _id: 9003, keywords: [{ keyword: 'explosion' }], categories: ['astronomy'], violence: true };
  const nameless = { _id: 9004, keywords: [], categories: ['astronomy'] };
  const { fetch, asked } = fakeFetch({ 'search/astronomy': [comet, classroom, phrase, scary, nameless] });
  assert.deepEqual(await browsePictograms('astronomy', { fetch }), [
    { pictogramId: 2711, image: imageUrl(2711), term: 'comet', keyword: 'comet', about: 'comet — (astronomy)', shelves: ['astronomy'] },
  ]);
  assert.deepEqual(asked, ['search/astronomy']);
  assert.deepEqual(await browsePictograms('nothing here', { fetch }), []);
});

test('falls back to the broad search, then to the next term', async () => {
  const { fetch, asked } = fakeFetch({ 'search/ringed%20planet': [], 'bestsearch/Saturn': [pictogram(10300, 'Saturn')] });
  const options = await findPictograms(['ringed planet', 'Saturn'], { fetch });
  assert.deepEqual(ids(options), [10300]);
  assert.equal(options[0].term, 'Saturn');
  assert.deepEqual(asked, ['bestsearch/ringed%20planet', 'search/ringed%20planet', 'bestsearch/Saturn']);
});

test('offers up to three pictures with their meanings, so the review can pick the right one', async () => {
  const soil = {
    _id: 3160,
    keywords: [{ keyword: 'ground', meaning: 'Soil on which plants grow' }, { keyword: 'earth' }],
    categories: ['agriculture', 'gardening', 'cattle farming'],
  };
  const planetEarth = { _id: 30014, keywords: [{ keyword: 'The Earth' }, { keyword: 'Earth' }], categories: ['astronomy', 'planet'] };
  const { fetch } = fakeFetch({
    'bestsearch/earth': [soil, planetEarth],
    'bestsearch/planet': [pictogram(2829, 'planet'), pictogram(9000, 'planet')],
  });
  const options = await findPictograms(['earth', 'planet'], { fetch });
  assert.deepEqual(ids(options), [3160, 30014, 2829]);
  assert.equal(options[0].about, 'ground/earth — Soil on which plants grow — (agriculture, gardening)');
  assert.equal(options[1].about, 'The Earth/Earth — (astronomy, planet)');
});

test('only accepts a pictogram that carries the term as a keyword', async () => {
  const { fetch } = fakeFetch({
    'search/dwarf%20planet': [pictogram(5450, 'dwarf'), pictogram(9999, 'Dwarf Planet')],
    'search/black%20hole': [pictogram(2886, 'black')],
  });
  assert.deepEqual(ids(await findPictograms(['dwarf planet'], { fetch })), [9999]);
  assert.deepEqual(await findPictograms(['black hole'], { fetch }), []);
});

test('matches keywords ignoring case, accents, and plural forms', async () => {
  const { fetch } = fakeFetch({ 'bestsearch/strawberries': [{ _id: 2400, keywords: [{ keyword: 'Strawberry', plural: 'strawberries' }] }] });
  assert.deepEqual(ids(await findPictograms(['strawberries'], { fetch })), [2400]);
});

test('skips pictograms marked as violent or sexual', async () => {
  const { fetch } = fakeFetch({
    'bestsearch/knife': [{ ...pictogram(1, 'knife'), violence: true }, { ...pictogram(2, 'knife'), sex: true }, pictogram(3, 'knife')],
  });
  assert.deepEqual(ids(await findPictograms(['knife'], { fetch })), [3]);
});

test('returns an empty list when no term has a pictogram', async () => {
  const { fetch } = fakeFetch({});
  assert.deepEqual(await findPictograms(['black hole'], { fetch }), []);
});

test('reports a failing service instead of guessing, after one more try', async () => {
  const { fetch, asked } = fakeFetch({ 'bestsearch/sun': 503 });
  await assert.rejects(findPictograms(['sun'], { fetch, retryDelay: 0 }), /ARASAAC answered 503/);
  assert.deepEqual(asked, ['bestsearch/sun', 'bestsearch/sun']);
});

test('tries once more after a dropped connection', async () => {
  let calls = 0;
  const fetch = async () => {
    calls++;
    if (calls === 1) throw new TypeError('fetch failed');
    return new Response(JSON.stringify([pictogram(2798, 'sun')]), { status: 200 });
  };
  assert.deepEqual(ids(await findPictograms(['sun'], { fetch, retryDelay: 0 })), [2798]);
  assert.equal(calls, 2);
});
