import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proposeConcepts, reviewCards } from '../lib/nova.js';
import { DeckError } from '../lib/deck.js';

const env = { AWS_BEARER_TOKEN_BEDROCK: 'test-key', AWS_REGION: 'us-east-1', NOVA_MODEL_ID: 'us.amazon.nova-2-lite-v1:0' };

// Fake Bedrock: answers with a tool call carrying `input`, and records the request.
function fakeBedrock(input, status = 200) {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    const body = status === 200 ? { output: { message: { content: [{ toolUse: { name: 'tool', input } }] } } } : { message: 'throttled' };
    return new Response(JSON.stringify(body), { status });
  };
  return { fetch, requests };
}

test('asks Nova through a forced tool, with the key as a bearer token', async () => {
  const { fetch, requests } = fakeBedrock({ suitable: true, concepts: [{ name: ' El Sol ', search: ['sun', ' star '] }, { name: '', search: ['x'] }, { name: 'La Luna', search: 'moon' }] });
  const concepts = await proposeConcepts({ topic: 'the solar system', language: 'Spanish', count: 36, avoid: ['Marte'] }, { fetch, env });
  assert.deepEqual(concepts, [{ name: 'El Sol', search: ['sun', 'star'] }, { name: 'La Luna', search: ['moon'] }]);
  const [{ url, headers, body }] = requests;
  assert.equal(url, 'https://bedrock-runtime.us-east-1.amazonaws.com/model/us.amazon.nova-2-lite-v1%3A0/converse');
  assert.equal(headers.Authorization, 'Bearer test-key');
  assert.deepEqual(body.toolConfig.toolChoice, { tool: { name: 'propose_concepts' } });
  assert.match(body.messages[0].content[0].text, /Topic: the solar system\nCard language: Spanish \(write every name in Spanish\)\nHow many: 36\nAvoid: Marte/);
});

test('a later round tells Nova which ideas had no picture', async () => {
  const { fetch, requests } = fakeBedrock({ suitable: true, concepts: [] });
  await proposeConcepts({ topic: 'space', language: 'English', count: 24, avoid: ['The Sun', 'The Quasar'], unpictured: ['The Quasar'] }, { fetch, env });
  assert.match(requests[0].body.messages[0].content[0].text, /How many: 24\nAvoid: The Sun; The Quasar\nNo picture exists for: The Quasar$/);
});

test('English titles get "The" instead of "A" or "An"; other languages are left alone', async () => {
  const proposed = fakeBedrock({ suitable: true, concepts: [{ name: 'A Comet', search: ['comet'] }, { name: 'an Astronaut', search: ['astronaut'] }, { name: 'The Sun', search: ['sun'] }, { name: 'Mars', search: ['mars'] }, { name: 'The Venus', search: ['venus'] }, { name: 'The Mars Rover', search: ['rover'] }] });
  const english = await proposeConcepts({ topic: 'space', language: 'English', count: 36 }, { fetch: proposed.fetch, env });
  assert.deepEqual(english.map(concept => concept.name), ['The Comet', 'The Astronaut', 'The Sun', 'Mars', 'Venus', 'The Mars Rover']); // planets take no article

  const candidates = [{ name: 'A Comet', options: [{ term: 'comet', about: '' }] }];
  const reviewed = fakeBedrock({ cards: [{ number: 1, keep: true, picture: 1, name: 'A Comet' }] });
  assert.equal((await reviewCards({ topic: 'space', language: 'English', candidates }, { fetch: reviewed.fetch, env }))[0].name, 'The Comet');

  const galician = fakeBedrock({ suitable: true, concepts: [{ name: 'A Coruña', search: ['city'] }] });
  assert.equal((await proposeConcepts({ topic: 'cities', language: 'Spanish', count: 36 }, { fetch: galician.fetch, env }))[0].name, 'A Coruña');
});

test('refuses a topic the AI judges unsuitable or nonsense', async () => {
  const { fetch } = fakeBedrock({ suitable: false, concepts: [] });
  await assert.rejects(
    proposeConcepts({ topic: 'zzzz', language: 'English', count: 36 }, { fetch, env }),
    error => error instanceof DeckError && error.code === 'unsuitable',
  );
});

test('reports a failing AI service', async () => {
  const { fetch } = fakeBedrock(null, 429);
  await assert.rejects(proposeConcepts({ topic: 'animals', language: 'English', count: 36 }, { fetch, env }), /Amazon Nova answered 429/);
});

test('the review returns one verdict per card, in order, with a valid picture number', async () => {
  const candidates = [
    { name: 'La Tierra', options: [{ term: 'earth', about: 'ground (agriculture)' }, { term: 'earth', about: 'The Earth (astronomy)' }] },
    { name: 'El Anillo', options: [{ term: 'ring', about: 'ring (jewelry)' }] },
    { name: 'Marte', options: [{ term: 'mars', about: 'Mars (planet)' }] },
  ];
  const { fetch, requests } = fakeBedrock({ cards: [
    { number: 2, keep: false, picture: 1, name: 'El Anillo' },
    { number: 1, keep: true, picture: 2, name: 'La Tierra' },
    { number: 3, keep: true, picture: 9, name: ' Marte ' }, // picture out of range → first picture
  ] });
  const verdicts = await reviewCards({ topic: 'the solar system', language: 'Spanish', candidates }, { fetch, env });
  assert.deepEqual(verdicts, [
    { keep: true, name: 'La Tierra', picture: 2 },
    { keep: false, name: 'El Anillo', picture: 1 },
    { keep: true, name: 'Marte', picture: 1 },
  ]);
  assert.match(requests[0].body.messages[0].content[0].text, /1\. La Tierra\n   picture 1: earth — ground \(agriculture\)\n   picture 2: earth — The Earth \(astronomy\)/);
});

test('the review is told when the titles are the library\'s raw keywords', async () => {
  const candidates = [{ name: 'planet', options: [{ term: 'planet', about: 'planet (astronomy)' }] }];
  const { fetch, requests } = fakeBedrock({ cards: [{ number: 1, keep: true, picture: 1, name: 'El Planeta' }] });
  const verdicts = await reviewCards({ topic: 'the solar system', language: 'Spanish', candidates, keywords: true }, { fetch, env });
  assert.equal(verdicts[0].name, 'El Planeta');
  assert.match(requests[0].body.messages[0].content[0].text, /Card language: Spanish\nThese titles are the picture library's own English keywords\. .* as a card title in Spanish, .*\nCards:\n1\. planet/);
});

test('a card the review skipped gets no verdict', async () => {
  const candidates = [{ name: 'A', options: [{ term: 'a', about: '' }] }, { name: 'B', options: [{ term: 'b', about: '' }] }];
  const { fetch } = fakeBedrock({ cards: [{ number: 1, keep: true, picture: 1, name: 'A' }] });
  assert.deepEqual(await reviewCards({ topic: 't', language: 'English', candidates }, { fetch, env }), [{ keep: true, name: 'A', picture: 1 }, null]);
});
