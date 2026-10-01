// Builds a 24-card deck: asks for more concepts than it needs, finds pictogram options for each,
// has the AI review them (keep or drop, best picture, corrected name), and holds the extras as
// spares for the "Regenerate" button. When the AI's ideas fall short, it looks at what the picture
// library itself has for the topic. moreCards() refills the spares when they run out.

export const DECK_SIZE = 24;
const CANDIDATES = 48; // ideas asked for first: about half end up as cards
const FILL_CANDIDATES = 24; // ideas asked for in a later round, when only a few cards are missing
const MORE_CANDIDATES = 12;
const ROUNDS = 4;
const PARALLEL_SEARCHES = 6;
const SHELF_SHARE = 0.3; // a library shelf belongs to the topic when this share of the deck's pictures sit on it
const SHELVES = 3; // shelves looked at, at most
const SHELF_CANDIDATES = 40; // pictures taken from those shelves in one go

export class DeckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// services.propose({ topic, language, count, avoid, unpictured }) → [{ name, search: [terms] }]
// services.find(terms) → [{ pictogramId, image, term, about, shelves }]   (empty when there is no picture)
// services.review({ topic, language, candidates }) → [{ keep, name, picture } | null]   (optional)
// services.browse(shelf) → [{ pictogramId, image, term, about, shelves }]   (optional)
export async function buildDeck({ topic, language }, services) {
  const deck = { topic, language, cards: [], spares: [] };
  const notes = {
    tried: [], // every idea so far, so none is proposed twice
    unpictured: [], // the ideas the picture library didn't have
    shelves: new Map(), // library shelf → how many of the deck's pictures sit on it
  };
  const add = cards => {
    for (const card of cards) (deck.cards.length < DECK_SIZE ? deck.cards : deck.spares).push(card);
  };
  for (let round = 0; round < ROUNDS && deck.cards.length < DECK_SIZE; round++) {
    const ideasSoFar = notes.tried.length;
    // A later round only has to fill the last few cards, and tells the AI which ideas had no picture.
    const request = round === 0
      ? { count: CANDIDATES, avoid: [] }
      : { count: FILL_CANDIDATES, avoid: [...notes.tried], unpictured: [...notes.unpictured] };
    add(await newCards({ topic, language, ...request, existing: allCards(deck) }, services, notes));
    if (notes.tried.length === ideasSoFar) break; // no ideas at all (a nonsense topic): asking again won't help
    // Before asking the AI to guess again, take what the library has on the topic's own shelves.
    if (round === 0 && deck.cards.length < DECK_SIZE) add(await shelfCards({ topic, language, existing: allCards(deck) }, services, notes.shelves));
  }
  if (deck.cards.length < DECK_SIZE) {
    throw new DeckError('too-narrow', `Only ${deck.cards.length} of ${DECK_SIZE} pictures were found for this topic.`);
  }
  return deck;
}

// More cards for the same topic, none repeating a name or pictogram in `existing`
// (the deck's cards, its spares, and the cards the teacher already swapped out).
export async function moreCards({ topic, language, existing }, services) {
  const notes = { tried: [], unpictured: [], shelves: new Map() };
  return newCards({ topic, language, count: MORE_CANDIDATES, avoid: existing.map(card => card.name), existing }, services, notes);
}

// One round: ideas → pictures → review → cards that are new to `existing`.
async function newCards({ topic, language, existing, ...request }, services, notes) {
  const concepts = await services.propose({ topic, language, ...request });
  notes.tried.push(...concepts.map(concept => concept.name));
  const candidates = await withPictures(existing, concepts, services.find, notes.unpictured);
  const verdicts = await review({ topic, language }, candidates, services.review);
  return acceptCards(existing, candidates, verdicts, notes.shelves);
}

// Cards from the picture library itself. The shelves (the library's categories) that many of the
// deck's pictures sit on hold every picture that exists for the topic, whatever the AI proposed.
// Their titles are the library's English keywords, so only the pictures the review kept, and
// titled in the card language, become cards.
async function shelfCards({ topic, language, existing }, services, shelves) {
  if (!services.browse || !services.review) return [];
  const wanted = [...shelves]
    .filter(([, count]) => count >= existing.length * SHELF_SHARE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHELVES)
    .map(([shelf]) => shelf);
  const found = (await Promise.all(wanted.map(shelf => services.browse(shelf).catch(() => [])))).flat();
  const used = new Set(existing.map(card => card.pictogramId));
  const pictures = found.filter(picture => !used.has(picture.pictogramId) && used.add(picture.pictogramId));
  // The pictures that sit on more of the topic's shelves come first.
  const fit = picture => wanted.filter(shelf => picture.shelves?.includes(shelf)).length;
  const candidates = pictures
    .sort((a, b) => fit(b) - fit(a))
    .slice(0, SHELF_CANDIDATES)
    .map(picture => ({ name: picture.term, options: [picture] }));
  const verdicts = await review({ topic, language, keywords: true }, candidates, services.review);
  const kept = candidates
    .map((candidate, i) => ({ candidate, verdict: verdicts[i] }))
    .filter(({ verdict }) => verdict?.keep && verdict.name)
    .map(({ candidate, verdict }) => ({ candidate, verdict: { ...verdict, name: shelfTitle(verdict.name, candidate.name, language) } }));
  return acceptCards(existing, kept.map(({ candidate }) => candidate), kept.map(({ verdict }) => verdict), shelves);
}

// The library writes common nouns in lower case ("planet") and proper names with a capital ("Mars").
// In English a common noun's title starts with "The", like the rest of the deck, even when the review left it bare.
const shelfTitle = (title, keyword, language) =>
  language === 'English' && /^\p{Ll}/u.test(keyword) && !/^the\s/i.test(title) ? `The ${title}` : title;

// Concepts not already on a card, with their picture options; concepts without any picture are
// dropped, and their names are added to `unpictured`.
async function withPictures(existing, concepts, find, unpictured) {
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
  const candidates = fresh.map((concept, i) => ({ name: concept.name, options: found[i] }));
  unpictured.push(...candidates.filter(candidate => !candidate.options.length).map(candidate => candidate.name));
  return candidates.filter(candidate => candidate.options.length);
}

// The review's verdicts, or none when there is no review or it fails (then every candidate keeps its first picture).
async function review(request, candidates, reviewCards) {
  if (!reviewCards || !candidates.length) return [];
  try {
    return await reviewCards({ ...request, candidates });
  } catch (error) {
    console.warn('card review skipped:', error.message);
    return [];
  }
}

// Reviewed candidates as cards, skipping any whose name or pictogram is already taken.
// `shelves` counts the library shelves the accepted pictures sit on.
function acceptCards(existing, candidates, verdicts, shelves) {
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
    for (const shelf of option.shelves ?? []) shelves.set(shelf, (shelves.get(shelf) ?? 0) + 1);
  });
  return cards;
}

const allCards = deck => [...deck.cards, ...deck.spares];

// "El Sol", "el sol", "El sól" and "Sol" count as the same card.
const ARTICLE = /^(the|an?|el|la|los|las|un|una|le|les|une|der|die|das|ein|eine|il|lo|gli|os?|as)\s+(?=\S)|^l['’]/;
const nameKey = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase().trim().replace(ARTICLE, '');

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
