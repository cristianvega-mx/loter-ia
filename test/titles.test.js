import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishTitle } from '../lib/titles.js';

test('an indefinite article becomes "The"', () => {
  assert.equal(englishTitle('A Comet'), 'The Comet');
  assert.equal(englishTitle('an Astronaut'), 'The Astronaut');
  assert.equal(englishTitle('The Telescope'), 'The Telescope');
  assert.equal(englishTitle('A'), 'A'); // a lone letter is a title, not an article
});

test('the planets take no article; the Sun, the Moon and the Earth do', () => {
  assert.equal(englishTitle('The Mars'), 'Mars');
  assert.equal(englishTitle('the venus'), 'Venus');
  assert.equal(englishTitle('Saturn'), 'Saturn');
  assert.equal(englishTitle('The Mars Rover'), 'The Mars Rover');
  assert.equal(englishTitle('Sun'), 'The Sun');
  assert.equal(englishTitle('earth', 'The Earth'), 'The Earth');
});

test('a bare title gets "The" only when the picture library writes its word as a common noun', () => {
  assert.equal(englishTitle('Comet', 'comet'), 'The Comet');
  assert.equal(englishTitle('Solar Eclipse', 'solar eclipse'), 'The Solar Eclipse');
  assert.equal(englishTitle('Mars', 'planet'), 'Mars'); // a planet's name over a picture filed as "planet"
  assert.equal(englishTitle('Halloween', 'Halloween'), 'Halloween');
  assert.equal(englishTitle('Comet'), 'Comet'); // nothing known about the word: left alone
  assert.equal(englishTitle('The Comet', 'comet'), 'The Comet');
});
