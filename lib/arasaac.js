// Finds ARASAAC pictograms for a concept, searching by its English terms.
// English avoids Spanish ambiguities: "cometa" is both a comet and a kite, "comet" is only the comet.

const API = 'https://api.arasaac.org/v1/pictograms/en';
const OPTIONS = 3;

export const imageUrl = id => `https://static.arasaac.org/pictograms/${id}/${id}_500.png`;

// Returns up to three pictograms that carry one of the terms as a keyword, best terms first:
// [{ pictogramId, image, term, about }]. Words have several meanings ("earth" is garden soil and the
// planet), so the review later picks the option that fits the topic; `about` is ARASAAC's own
// description of each picture for that choice. An empty list means no suitable pictogram exists.
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
          options.push({ pictogramId: pictogram._id, image: imageUrl(pictogram._id), term, about: describe(pictogram) });
        }
      }
      if (matches.length) break; // the exact search found it; the broad one would only add noise
    }
    if (options.length >= OPTIONS) break;
  }
  return options;
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
