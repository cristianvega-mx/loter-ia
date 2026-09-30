import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardsPdf, cardsPdf } from '../lib/pdf.js';

const deck = Array.from({ length: 24 }, (_, i) => ({ name: i === 0 ? 'Júpiter' : `Card ${i}`, pictogramId: 1000 + i }));
// A real 1 × 1 PNG, so the PDF maker embeds actual pictures without touching the network.
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const fetchImage = async () => tinyPng;

const text = pdf => pdf.toString('latin1');
const pageCount = pdf => (text(pdf).match(/\/Type\s*\/Page[^s]/g) || []).length;
const imageCount = pdf => (text(pdf).match(/\/Subtype\s*\/Image/g) || []).length;

test('the boards PDF has one landscape letter page per board', async () => {
  const pdf = await boardsPdf({ topic: 'the solar system', cards: deck, count: 3 }, { fetchImage });
  assert.equal(text(pdf).slice(0, 5), '%PDF-');
  assert.equal(pageCount(pdf), 3);
  assert.match(text(pdf), /\/MediaBox\s*\[0 0 792 612\]/);
});

test('each picture is embedded once, however many boards show it', async () => {
  const pdf = await boardsPdf({ topic: 'the solar system', cards: deck, count: 30 }, { fetchImage });
  assert.equal(pageCount(pdf), 30);
  // A picture with transparency is stored as two image objects: the picture and its mask.
  assert.ok(imageCount(pdf) <= deck.length * 2, `found ${imageCount(pdf)} embedded images`);
});

test('the cards PDF puts the 24 cards on 3 pages', async () => {
  const pdf = await cardsPdf({ topic: 'the solar system', cards: deck }, { fetchImage });
  assert.equal(pageCount(pdf), 3);
});

test('a picture that cannot be fetched still leaves a complete PDF', async () => {
  const flaky = async id => {
    if (id === 1003) throw new Error('ARASAAC answered 503');
    return tinyPng;
  };
  const pdf = await cardsPdf({ topic: 'the solar system', cards: deck }, { fetchImage: flaky });
  assert.equal(pageCount(pdf), 3);
});

test('refuses a board count outside 1–60', async () => {
  await assert.rejects(boardsPdf({ topic: 'x', cards: deck, count: 61 }, { fetchImage }), RangeError);
});
