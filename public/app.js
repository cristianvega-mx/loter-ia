// Loter-IA page: asks the server for a deck, shows the cards, swaps cards on "Regenerate",
// and prints boards and cards. Everything lives in this page while it's open; nothing is saved.

import { makeBoards, MAX_BOARDS } from './boards.js';

const COLORS = ['#F5C842', '#7FB3E6', '#E88AA6', '#8FCF9F'];
const DECK_SIZE = 24;
const CARDS_PER_PAGE = 8;
const CREDIT = 'Pictograms: Sergio Palao. Origin: ARASAAC (arasaac.org). License: CC (BY-NC-SA). Owner: Government of Aragón (Spain).';
// deck: { topic, language, cards, spares } from the server; removed: cards the teacher swapped out,
// so "Regenerate" never brings them back.
const state = { deck: null, removed: [] };

const $ = id => document.getElementById(id);

$('start-form').addEventListener('submit', async event => {
  event.preventDefault();
  const topic = $('topic').value.trim();
  const language = $('language').value;
  if (!topic) {
    showStatus('Type a topic first.', true);
    $('topic').focus();
    return;
  }
  setBusy(true);
  showStatus('Creating your Lotería…');
  showDeckStatus('');
  document.body.classList.remove('has-print');
  showPlaceholders(topic);
  try {
    state.deck = await post('/api/deck', { topic, language });
    state.removed = [];
    showStatus('');
    renderDeck();
  } catch (error) {
    state.deck = null;
    $('deck').hidden = true;
    showStatus(error.message, true);
  } finally {
    setBusy(false);
  }
});

$('cards').addEventListener('click', event => {
  const button = event.target.closest('.regen');
  if (button) regenerate(Number(button.closest('.card').dataset.index));
});

async function regenerate(index) {
  const slot = $('cards').children[index];
  if (!state.deck || slot.classList.contains('is-loading')) return;
  slot.classList.add('is-loading');
  setNote(slot, 'Finding a new card…');
  try {
    if (!state.deck.spares.length) {
      const { topic, language, cards, spares } = state.deck;
      const more = await post('/api/more', { topic, language, existing: [...cards, ...spares, ...state.removed] });
      state.deck.spares.push(...more.cards);
    }
    const next = state.deck.spares.shift();
    if (!next) {
      slot.classList.remove('is-loading');
      setNote(slot, 'No more cards for this topic.');
      return;
    }
    state.removed.push(state.deck.cards[index]);
    state.deck.cards[index] = next;
    const fresh = cardElement(next, index);
    fresh.classList.add('is-new');
    slot.replaceWith(fresh);
  } catch {
    slot.classList.remove('is-loading');
    setNote(slot, "Couldn't get a new card. Try again.");
  }
}

$('boards-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!state.deck) return;
  const count = Number($('board-count').value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BOARDS) {
    showDeckStatus(`Choose between 1 and ${MAX_BOARDS} boards.`, true);
    $('board-count').focus();
    return;
  }
  showDeckStatus('');
  const boards = makeBoards(state.deck.cards, count);
  await printPages(boards.map(board => boardPage(board, boards.length)));
});

$('print-cards').addEventListener('click', async () => {
  if (!state.deck) return;
  const pages = [];
  for (let start = 0; start < state.deck.cards.length; start += CARDS_PER_PAGE) {
    pages.push(cardsPage(state.deck.cards.slice(start, start + CARDS_PER_PAGE)));
  }
  await printPages(pages);
});

// Puts the pages in the print area (the only thing print styles show), waits for every picture,
// then opens the browser's print dialog, where the teacher can print or "Save as PDF".
async function printPages(pages) {
  $('print-area').replaceChildren(...pages);
  document.body.classList.add('has-print');
  await Promise.all([...$('print-area').querySelectorAll('img')].map(image => image.decode().catch(() => {})));
  window.print();
}

function boardPage(board, total) {
  const page = printPage(`Board ${board.number} of ${total}`);
  const grid = document.createElement('div');
  grid.className = 'board-grid';
  grid.append(...board.cards.map(printCard));
  page.querySelector('.print-body').append(grid);
  return page;
}

function cardsPage(cards) {
  const page = printPage('Cards');
  const grid = document.createElement('div');
  grid.className = 'cut-grid';
  grid.append(...cards.map(printCard));
  page.querySelector('.print-body').append(grid);
  return page;
}

function printPage(label) {
  const page = document.createElement('section');
  page.className = 'print-page';
  const head = document.createElement('header');
  head.className = 'print-head';
  for (const [className, text] of [['print-brand', 'Loter-IA'], ['print-topic', state.deck.topic], ['print-label', label]]) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    head.append(span);
  }
  const body = document.createElement('div');
  body.className = 'print-body';
  const credit = document.createElement('p');
  credit.className = 'print-credit';
  credit.textContent = CREDIT;
  page.append(head, body, credit);
  return page;
}

// A card keeps the same color everywhere (deck, boards, printed cards), so it's easy to spot.
function printCard(card) {
  const box = document.createElement('div');
  box.className = 'print-card';
  box.style.setProperty('--card-color', COLORS[Math.max(0, state.deck.cards.indexOf(card)) % COLORS.length]);
  const art = document.createElement('div');
  art.className = 'art';
  const image = document.createElement('img');
  image.src = card.image;
  image.alt = '';
  art.append(image);
  const name = document.createElement('p');
  name.className = 'name';
  name.textContent = card.name;
  box.append(art, name);
  return box;
}

function showDeckStatus(message, isError = false) {
  $('deck-status').textContent = message;
  $('deck-status').classList.toggle('error', isError);
}

function renderDeck() {
  const { topic, language, cards } = state.deck;
  $('deck-title').textContent = `${topic} · ${language}`;
  $('cards').replaceChildren(...cards.map(cardElement));
  $('deck').hidden = false;
}

function cardElement(card, index) {
  const item = document.createElement('li');
  item.className = 'card';
  item.dataset.index = index;
  item.style.setProperty('--card-color', COLORS[index % COLORS.length]);
  const art = document.createElement('div');
  art.className = 'art';
  const image = document.createElement('img');
  image.src = card.image;
  image.alt = '';
  image.loading = 'lazy';
  art.append(image);
  const name = document.createElement('p');
  name.className = 'name';
  name.textContent = card.name;
  const regen = document.createElement('button');
  regen.type = 'button';
  regen.className = 'regen';
  regen.textContent = '↻ Regenerate';
  regen.setAttribute('aria-label', `Regenerate ${card.name}`);
  const note = document.createElement('p');
  note.className = 'note';
  note.setAttribute('role', 'status');
  item.append(art, name, regen, note);
  return item;
}

function setNote(slot, message) {
  slot.querySelector('.note').textContent = message;
}

// 24 blank cards while the AI works, so the teacher sees the deck taking shape.
function showPlaceholders(topic) {
  $('deck-title').textContent = topic;
  $('cards').replaceChildren(...Array.from({ length: DECK_SIZE }, (_, index) => {
    const item = document.createElement('li');
    item.className = 'card placeholder';
    item.style.setProperty('--card-color', COLORS[index % COLORS.length]);
    item.innerHTML = '<div class="art"></div><p class="name">&nbsp;</p>';
    return item;
  }));
  $('deck').hidden = false;
}

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const answer = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(answer.message || 'Something went wrong while creating your Lotería.');
  return answer;
}

function setBusy(busy) {
  $('create').disabled = busy;
  $('deck').setAttribute('aria-busy', String(busy));
}

function showStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}
