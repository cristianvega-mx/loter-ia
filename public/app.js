// Loter-IA page: asks the server for a deck and shows the cards.
// Everything lives in this page while it's open; nothing is saved.

const COLORS = ['#F5C842', '#7FB3E6', '#E88AA6', '#8FCF9F'];
const DECK_SIZE = 24;
const state = { deck: null };

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
  showPlaceholders(topic);
  try {
    const response = await fetch('/api/deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, language }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || 'Something went wrong while creating your Lotería.');
    state.deck = body;
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

function renderDeck() {
  const { topic, language, cards } = state.deck;
  $('deck-title').textContent = `${topic} · ${language}`;
  $('cards').replaceChildren(...cards.map(cardElement));
  $('deck').hidden = false;
}

function cardElement(card, index) {
  const item = document.createElement('li');
  item.className = 'card';
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
  item.append(art, name);
  return item;
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

function setBusy(busy) {
  $('create').disabled = busy;
  $('deck').setAttribute('aria-busy', String(busy));
}

function showStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}
