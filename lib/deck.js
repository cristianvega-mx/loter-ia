// Builds a 24-card deck: asks for more concepts than it needs, finds pictogram options for each,
// has the AI review them (keep or drop, best picture, corrected name), and holds the extras as
// spares for the "Regenerate" button. moreCards() refills the spares when they run out.

export const DECK_SIZE = 24;
const CANDIDATES = 36;
const MORE_CANDIDATES = 12;
const ROUNDS = 3;
const PARALLEL_SEARCHES = 6;

export class DeckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// services.propose({ topic, language, count, avoid }) → [{ name, search: [terms] }]
// services.find(terms) → [{ pictogramId, image, term, about }]   (empty when there is no picture)
// services.review({ topic, language, candidates }) → [{ keep, name, picture } | null]   (optional)
export async function buildDeck({ topic, language }, services) {
  const deck = { topic, language, cards: [], spares: [] };
  const tried = [];
  for (let round = 0; round < ROUNDS && deck.cards.length < DECK_SIZE; round++) {
    const fresh = await newCards({ topic, language, count: CANDIDATES, avoid: [...tried], existing: allCards(deck) }, services, tried);
    for (const card of fresh) (deck.cards.length < DECK_SIZE ? deck.cards : deck.spares).push(card);
  }
  if (deck.cards.length < DECK_SIZE) {
    throw new DeckError('too-narrow', `Only ${deck.cards.length} of ${DECK_SIZE} pictures were found for this topic.`);
  }
  return deck;
}

// More cards for the same topic, none repeating a name or pictogram in `existing`
// (the deck's cards, its spares, and the cards the teacher already swapped out).
export async function moreCards({ topic, language, existing }, services) {
  return newCards({ topic, language, count: MORE_CANDIDATES, avoid: existing.map(card => card.name), existing }, services, []);
}

// One round: ideas → pictures → review → cards that are new to `existing`.
async function newCards({ topic, language, count, avoid, existing }, services, tried) {
  const concepts = await services.propose({ topic, language, count, avoid });
  tried.push(...concepts.map(concept => concept.name));
  const candidates = await withPictures(existing, concepts, services.find);
  const verdicts = await review({ topic, language }, candidates, services.review);
  return acceptCards(existing, candidates, verdicts);
}

// Concepts not already on a card, with their picture options; concepts without any picture are dropped.
async function withPictures(existing, concepts, find) {
  const names = new Set(existing.map(card => nameKey(card.name)));
  const fresh = concepts.filter(concept => {
    const key = nameKey(concept.name);
    if (names.has(key)) return false;
    names.add(key);
    return true;
  });
  // One failed lookup just loses that concept; if most lookups fail, the picture service is down.
  const failures = [];
  const found = await mapLimit(fresh, PARALLEL_SEARCHES, concept =>
    find(concept.search).catch(error => {
      failures.push(error);
      return [];
    }),
  );
  if (failures.length && failures.length >= fresh.length / 2) throw failures[0];
  return fresh.map((concept, i) => ({ name: concept.name, options: found[i] })).filter(candidate => candidate.options.length);
}

// The review's verdicts, or none when there is no review or it fails (then every candidate keeps its first picture).
async function review({ topic, language }, candidates, reviewCards) {
  if (!reviewCards || !candidates.length) return [];
  try {
    return await reviewCards({ topic, language, candidates });
  } catch (error) {
    console.warn('card review skipped:', error.message);
    return [];
  }
}

// Reviewed candidates as cards, skipping any whose name or pictogram is already taken.
function acceptCards(existing, candidates, verdicts) {
  const names = new Set(existing.map(card => nameKey(card.name)));
  const pictograms = new Set(existing.map(card => card.pictogramId));
  const cards = [];
  candidates.forEach((candidate, i) => {
    const verdict = verdicts[i];
    if (verdict && !verdict.keep) return;
    const option = candidate.options[(verdict?.picture ?? 1) - 1] ?? candidate.options[0];
    const name = verdict?.name || candidate.name;
    if (names.has(nameKey(name)) || pictograms.has(option.pictogramId)) return;
    names.add(nameKey(name));
    pictograms.add(option.pictogramId);
    cards.push({ name, search: option.term, pictogramId: option.pictogramId, image: option.image });
  });
  return cards;
}

const allCards = deck => [...deck.cards, ...deck.spares];

// "El Sol", "el sol" and "El sól" count as the same card.
const nameKey = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase().trim();

// Like Promise.all over items.map(fn), with at most `limit` calls running at once.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
