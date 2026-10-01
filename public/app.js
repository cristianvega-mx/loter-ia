// Loter-IA page: asks the server for a deck, shows the cards, swaps cards on "Regenerate",
// downloads the boards and the cards as PDFs, and calls the cards on screen. Everything lives in
// this page while it's open; nothing is saved.

import { shuffle } from './shuffle.js';

const COLORS = ['#F5C842', '#7FB3E6', '#E88AA6', '#8FCF9F'];
const DECK_SIZE = 24;
const MAX_BOARDS = 60;
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

$('boards-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!state.deck) return;
  const count = Number($('board-count').value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BOARDS) {
    showDeckStatus(`Choose between 1 and ${MAX_BOARDS} boards.`, true);
    $('board-count').focus();
    return;
  }
  download('/api/boards.pdf', { ...printable(), count }, $('download-boards'), 'Making your boards…');
});

$('download-cards').addEventListener('click', () => {
  if (state.deck) download('/api/cards.pdf', printable(), $('download-cards'), 'Making your cards…');
});

$('call-cards').addEventListener('click', openCaller);
$('caller-back').addEventListener('click', closeCaller);

document.addEventListener('keydown', event => {
  if ($('caller').hidden) return;
  const step = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[event.key];
  if (step) {
    event.preventDefault();
    $('feed').scrollBy({ top: step * $('feed').clientHeight, behavior: 'smooth' });
  } else if (event.key === 'Escape') {
    closeCaller();
  }
});

// A full-screen feed with the deck shuffled: one card per screen, then an end card.
// The browser's own scrolling does the moving (swipe, wheel, trackpad); CSS snaps it card by card.
function openCaller() {
  if (!state.deck) return;
  const { cards } = state.deck;
  const slides = shuffle(cards).map((card, position) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const big = document.createElement('div');
    big.className = 'big-card';
    big.style.setProperty('--card-color', COLORS[cards.indexOf(card) % COLORS.length]);
    const art = document.createElement('div');
    art.className = 'art';
    const image = document.createElement('img');
    image.src = card.image;
    image.alt = '';
    art.append(image);
    const name = document.createElement('p');
    name.className = 'name';
    name.textContent = card.name;
    big.append(art, name);
    slide.append(big);
    if (position === 0) {
      const hint = document.createElement('p');
      hint.className = 'caller-hint';
      hint.textContent = 'Swipe up, scroll, or press ↓ for the next card';
      slide.append(hint);
    }
    return slide;
  });
  const end = document.createElement('div');
  end.className = 'slide end-slide';
  const message = document.createElement('p');
  message.className = 'end-message';
  message.textContent = `All ${cards.length} cards have been called`;
  end.append(message);
  $('feed').replaceChildren(...slides, end);
  $('caller').hidden = false;
  document.body.classList.add('calling');
  $('feed').scrollTop = 0;
  $('feed').focus();
}

function closeCaller() {
  $('caller').hidden = true;
  document.body.classList.remove('calling');
  $('call-cards').focus();
}

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

// What the server needs to draw the PDFs: the topic and the deck in order (a card's color follows its place).
function printable() {
  const { topic, cards } = state.deck;
  return { topic, cards: cards.map(({ name, pictogramId }) => ({ name, pictogramId })) };
}

// Asks the server for a PDF and hands it to the browser as a download.
async function download(url, body, button, busyLabel) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  showDeckStatus('');
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
      const answer = await response.json().catch(() => ({}));
      throw new Error(answer.message || "Couldn't make the PDF. Try again.");
    }
    const file = await response.blob();
    const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'loter-ia.pdf';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    showDeckStatus(`Downloaded ${name}`);
  } catch (error) {
    showDeckStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
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

function showDeckStatus(message, isError = false) {
  $('deck-status').textContent = message;
  $('deck-status').classList.toggle('error', isError);
}
