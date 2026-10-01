// Checks pictogram coverage for a few school topics with the real services (spec.md > Plan B).
// If "the solar system" or most of these topics can't reach 24 cards, the build switches to Plan B.
// Run: npm run coverage   (uses Amazon Nova, about a cent per topic)

import { proposeConcepts, reviewCards } from '../lib/nova.js';
import { browsePictograms, findPictograms } from '../lib/arasaac.js';
import { buildDeck, DeckError } from '../lib/deck.js';

const TOPICS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['the solar system', 'farm animals', 'fruits and vegetables', 'the human body', 'jobs', 'the weather'];

let complete = 0;
for (const topic of TOPICS) {
  const started = Date.now();
  try {
    const deck = await buildDeck({ topic, language: 'Spanish' }, { propose: proposeConcepts, find: findPictograms, review: reviewCards, browse: browsePictograms });
    complete++;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n${topic}: ${deck.cards.length} cards + ${deck.spares.length} spares in ${seconds}s`);
    console.log('  ' + deck.cards.map(card => `${card.name} (${card.search}→${card.pictogramId})`).join(', '));
  } catch (error) {
    console.log(`\n${topic}: ${error instanceof DeckError ? error.message : `failed: ${error.message}`}`);
  }
}
console.log(`\n${complete} of ${TOPICS.length} topics reached 24 cards.`);
