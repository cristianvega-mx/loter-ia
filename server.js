// Loter-IA web server: serves the page in public/ and creates decks.
// The Amazon key stays here; the page only ever sees cards.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { proposeConcepts, reviewCards } from './lib/nova.js';
import { findPictograms } from './lib/arasaac.js';
import { buildDeck, DeckError } from './lib/deck.js';

const PUBLIC = join(import.meta.dirname, 'public');
const LANGUAGES = ['Spanish', 'English', 'French', 'Portuguese', 'German', 'Italian'];
const MAX_TOPIC = 80;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const services = { propose: proposeConcepts, find: findPictograms, review: reviewCards };

class RequestError extends Error {}

const api = {
  '/api/deck': async body => {
    const { topic, language } = readDeckRequest(body);
    return buildDeck({ topic, language }, services);
  },
};

function readDeckRequest(body) {
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  if (!topic) throw new RequestError('Type a topic first.');
  if (topic.length > MAX_TOPIC) throw new RequestError(`Keep the topic under ${MAX_TOPIC} characters.`);
  if (!LANGUAGES.includes(body?.language)) throw new RequestError('Pick one of the card languages.');
  return { topic, language: body.language };
}

async function handleApi(req, res, handler) {
  let status = 200;
  let payload;
  try {
    const body = JSON.parse((await readBody(req)) || '{}');
    payload = await handler(body);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof RequestError) {
      status = 400;
      payload = { error: 'bad-request', message: error instanceof RequestError ? error.message : 'The request was not valid.' };
    } else if (error instanceof DeckError) {
      status = 422;
      payload = { error: error.code, message: "This topic doesn't have enough pictures yet. Try a broader topic." };
    } else {
      console.error('creating a deck failed:', error.message);
      status = 502;
      payload = { error: 'upstream', message: 'Something went wrong while creating your Lotería.' };
    }
  }
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');
}

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = normalize(join(PUBLIC, path === '/' ? 'index.html' : path));
  if (!file.startsWith(PUBLIC + sep) || !TYPES[extname(file)]) return send(res, 404, 'Not found', 'text/plain');
  try {
    send(res, 200, await readFile(file), TYPES[extname(file)]);
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10_000) reject(new RequestError('The request is too large.'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const port = Number(process.env.PORT) || 3000;
createServer((req, res) => {
  const handler = api[new URL(req.url, 'http://localhost').pathname];
  if (handler && req.method === 'POST') return handleApi(req, res, handler);
  if (req.method === 'GET') return serveStatic(req, res);
  send(res, 405, 'Method not allowed', 'text/plain');
}).listen(port, () => console.log(`Loter-IA is running at http://localhost:${port}`));
