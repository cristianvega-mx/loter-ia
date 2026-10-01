// Loter-IA web server: serves the page in public/, creates decks, and makes the PDF downloads.
// The Amazon key stays here; the page only ever sees cards.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { proposeConcepts, reviewCards } from './lib/nova.js';
import { browsePictograms, findPictograms } from './lib/arasaac.js';
import { buildDeck, moreCards, DeckError } from './lib/deck.js';
import { boardsPdf, cardsPdf } from './lib/pdf.js';
import { BOARD_SIZE, MAX_BOARDS } from './lib/boards.js';
import { createLimiter, LimitError } from './lib/limit.js';

const PUBLIC = join(import.meta.dirname, 'public');
const LANGUAGES = ['Spanish', 'English', 'French', 'Portuguese', 'German', 'Italian'];
const MAX_TOPIC = 80;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const services = { propose: proposeConcepts, find: findPictograms, review: reviewCards, browse: browsePictograms };
// Only the requests that use the AI count toward the daily limit; the PDFs cost nothing.
const countToday = createLimiter({ decks: Number(process.env.DAILY_DECKS) || 100, more: Number(process.env.DAILY_MORE) || 300 });

class RequestError extends Error {}

// Each route: what it does with the request body, and what the teacher reads if it fails.
const api = {
  '/api/deck': {
    failure: 'Something went wrong while creating your Lotería.',
    run: async body => {
      const request = readDeckRequest(body);
      countToday('decks');
      return buildDeck(request, services);
    },
  },
  // More cards for "Regenerate" once the spares run out. `existing` lists every card the page
  // has seen for this deck (cards, spares, and swapped-out cards) so none comes back.
  '/api/more': {
    failure: "Couldn't get a new card. Try again.",
    run: async body => {
      const request = { ...readDeckRequest(body), existing: readExisting(body.existing) };
      countToday('more');
      return { cards: await moreCards(request, services) };
    },
  },
  '/api/boards.pdf': {
    failure: "Couldn't make the PDF. Try again.",
    run: async body => {
      const { topic, cards } = readPrintRequest(body);
      const count = Number(body.count);
      if (!Number.isInteger(count) || count < 1 || count > MAX_BOARDS) throw new RequestError(`Choose between 1 and ${MAX_BOARDS} boards.`);
      return { file: await boardsPdf({ topic, cards, count }), name: `loter-ia-boards-${slug(topic)}.pdf` };
    },
  },
  '/api/cards.pdf': {
    failure: "Couldn't make the PDF. Try again.",
    run: async body => {
      const { topic, cards } = readPrintRequest(body);
      return { file: await cardsPdf({ topic, cards }), name: `loter-ia-cards-${slug(topic)}.pdf` };
    },
  },
};

function readDeckRequest(body) {
  const topic = readTopic(body);
  if (!LANGUAGES.includes(body?.language)) throw new RequestError('Pick one of the card languages.');
  return { topic, language: body.language };
}

function readTopic(body) {
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  if (!topic) throw new RequestError('Type a topic first.');
  if (topic.length > MAX_TOPIC) throw new RequestError(`Keep the topic under ${MAX_TOPIC} characters.`);
  return topic;
}

function readExisting(existing) {
  if (!Array.isArray(existing) || existing.length > 300) throw new RequestError('The list of cards was not valid.');
  return existing.map(card => ({ name: String(card?.name ?? '').slice(0, MAX_TOPIC), pictogramId: Number(card?.pictogramId) }));
}

function readPrintRequest(body) {
  const topic = readTopic(body);
  const cards = body?.cards;
  const valid = card => typeof card?.name === 'string' && card.name.trim() && card.name.length <= MAX_TOPIC && Number.isInteger(card.pictogramId) && card.pictogramId > 0;
  if (!Array.isArray(cards) || cards.length < BOARD_SIZE || cards.length > 60 || !cards.every(valid)) {
    throw new RequestError('The deck was not valid. Create your Lotería again.');
  }
  return { topic, cards: cards.map(card => ({ name: card.name.trim(), pictogramId: card.pictogramId })) };
}

const slug = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'loteria';

async function handleApi(req, res, route) {
  try {
    const body = JSON.parse((await readBody(req)) || '{}');
    const result = await route.run(body);
    if (result?.file) {
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.name}"`,
        'Cache-Control': 'no-store',
      });
      return res.end(result.file);
    }
    sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof RequestError) {
      sendJson(res, 400, { error: 'bad-request', message: error instanceof RequestError ? error.message : 'The request was not valid.' });
    } else if (error instanceof LimitError) {
      sendJson(res, 429, { error: 'limit', message: "Loter-IA has reached today's limit. Please try again tomorrow." });
    } else if (error instanceof DeckError) {
      const message = error.code === 'unsuitable'
        ? "Loter-IA can't make a Lotería for this topic. Try a different one."
        : "This topic doesn't have enough pictures yet. Try a broader topic.";
      sendJson(res, 422, { error: error.code, message });
    } else {
      console.error(`${req.url} failed:`, error.message);
      sendJson(res, 502, { error: 'upstream', message: route.failure });
    }
  }
}

async function serveStatic(req, res) {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request', 'text/plain');
  }
  const file = normalize(join(PUBLIC, path === '/' ? 'index.html' : path));
  if (!file.startsWith(PUBLIC + sep) || !TYPES[extname(file)]) return send(res, 404, 'Not found', 'text/plain');
  try {
    send(res, 200, await readFile(file), TYPES[extname(file)]);
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}

// Past the size limit the rest of the upload is thrown away, so a huge request can't fill the server's memory.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > 20_000) {
        tooLarge = true;
        body = '';
        reject(new RequestError('The request is too large.'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const sendJson = (res, status, payload) => send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const port = Number(process.env.PORT) || 3000;
createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    return send(res, 400, 'Bad request', 'text/plain');
  }
  const route = Object.hasOwn(api, pathname) ? api[pathname] : null;
  if (route && req.method === 'POST') return handleApi(req, res, route);
  if (req.method === 'GET') return serveStatic(req, res);
  send(res, 405, 'Method not allowed', 'text/plain');
}).listen(port, () => console.log(`Loter-IA is running at http://localhost:${port}`));
