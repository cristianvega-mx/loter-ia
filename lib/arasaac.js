// Finds ARASAAC pictograms for a concept, searching by its English terms.
// English avoids Spanish ambiguities: "cometa" is both a comet and a kite, "comet" is only the comet.

const API = 'https://api.arasaac.org/v1/pictograms/en';
const OPTIONS = 3;

export const imageUrl = id => `https://static.arasaac.org/pictograms/${id}/${id}_500.png`;

// Returns up to three pictograms that carry one of the terms as a keyword, best terms first:
// [{ pictogramId, image, term, about, shelves }]. Words have several meanings ("earth" is garden soil
// and the planet), so the review later picks the option that fits the topic; `about` is ARASAAC's own
// description of each picture for that choice, and `shelves` the categories the library files it
// under. An empty list means no suitable pictogram exists.
export async function findPictograms(terms, { fetch = globalThis.fetch, retryDelay = 800 } = {}) {
  const options = [];
  for (const term of terms) {
    for (const kind of ['bestsearch', 'search']) {
      const response = await fetchOnceMore(fetch, `${API}/${kind}/${encodeURIComponent(term)}`, retryDelay);
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`ARASAAC answered ${response.status}`);
      const matches = (await response.json()).filter(pictogram => !pictogram.violence && !pictogram.sex && hasKeyword(pictogram, term));
      for (const pictogram of matches) {
        if (options.length < OPTIONS && !options.some(option => option.pictogramId === pictogram._id)) {
          options.push({ pictogramId: pictogram._id, image: imageUrl(pictogram._id), term, about: describe(pictogram), shelves: shelvesOf(pictogram) });
        }
      }
      if (matches.length) break; // the exact search found it; the broad one would only add noise
    }
    if (options.length >= OPTIONS) break;
  }
  return options;
}

// Every pictogram the library files under one shelf (a category such as "astronomy"), each with
// the library's own English keyword as its `term`. This is what really exists for a topic, for
// when guessing concept by concept comes up short.
export async function browsePictograms(shelf, { fetch = globalThis.fetch, retryDelay = 800 } = {}) {
  const response = await fetchOnceMore(fetch, `${API}/search/${encodeURIComponent(shelf)}`, retryDelay);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`ARASAAC answered ${response.status}`);
  return (await response.json())
    .filter(pictogram => !pictogram.violence && !pictogram.sex && shelvesOf(pictogram).includes(shelf))
    .map(pictogram => ({
      pictogramId: pictogram._id,
      image: imageUrl(pictogram._id),
      term: String(pictogram.keywords?.[0]?.keyword ?? '').trim(),
      about: describe(pictogram),
      shelves: shelvesOf(pictogram),
    }))
    .filter(picture => picture.term && !/[?!]/.test(picture.term)); // "is it raining?" is a phrase, not a card
}

// The library's categories and tags for a pictogram, without its catch-all "core vocabulary" ones.
function shelvesOf(pictogram) {
  const shelves = [...(pictogram.categories ?? []), ...(pictogram.tags ?? [])].filter(shelf => !String(shelf).startsWith('core vocabulary'));
  return [...new Set(shelves)];
}

// "ground/earth — Soil on which plants grow (agriculture, gardening)"
function describe(pictogram) {
  const keywords = pictogram.keywords ?? [];
  const words = keywords.slice(0, 2).map(({ keyword }) => keyword).join('/');
  const meaning = (keywords.find(({ meaning }) => meaning)?.meaning ?? '').replace(/^[mf]\.\s*/, '').slice(0, 70);
  const categories = (pictogram.categories ?? []).slice(0, 2).join(', ');
  return [words, meaning, categories && `(${categories})`].filter(Boolean).join(' — ');
}

// A dropped connection or a busy server gets one more try before counting as a failure.
async function fetchOnceMore(fetch, url, retryDelay) {
  const attempt = () => fetch(url, { signal: AbortSignal.timeout(15_000) });
  try {
    const response = await attempt();
    if (response.status !== 429 && response.status < 500) return response;
  } catch {
    // network error: fall through to the second try
  }
  await new Promise(resolve => setTimeout(resolve, retryDelay));
  return attempt();
}

const plain = text => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function hasKeyword(pictogram, term) {
  const wanted = plain(term);
  return (pictogram.keywords ?? []).some(({ keyword, plural }) => plain(keyword) === wanted || plain(plural) === wanted);
}
