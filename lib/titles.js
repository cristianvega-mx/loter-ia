// Small fixes to English card titles, where Nova is inconsistent: "A Comet" or a bare "Comet" next
// to "The Sun", and "The Mars" next to "Venus". A deck reads better when its common nouns all take
// "The" and its planets take no article.

const PLANET = /^(?:the\s+)?(mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)$/i;
const OUR_OWN = /^(sun|moon|earth)$/i; // the three that do take the article

// `keyword` is the picture library's own word for the card's picture, when known. The library
// writes common nouns in lower case ("comet") and proper names with a capital ("Halloween"), which
// tells a bare "Comet" (→ "The Comet") from a bare "Halloween" (left as it is).
export function englishTitle(title, keyword = '') {
  const planet = PLANET.exec(title);
  if (planet) return capitalize(planet[1]);
  if (OUR_OWN.test(title)) return `The ${capitalize(title)}`;
  const withThe = title.replace(/^an?\s+(?=\S)/i, 'The ');
  return /^\p{Ll}/u.test(keyword) && !/^the\s/i.test(withThe) ? `The ${withThe}` : withThe;
}

const capitalize = word => word[0].toUpperCase() + word.slice(1).toLowerCase();
