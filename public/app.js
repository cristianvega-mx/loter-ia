// Loter-IA page: asks the server for a deck, shows the cards, swaps cards on "Regenerate",
// and downloads the boards and the cards as PDFs. Everything lives in this page while it's open;
// nothing is saved.

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

function showDeckStatus(message, isError = false) {
  $('deck-status').textContent = message;
  $('deck-status').classList.toggle('error', isError);
}
