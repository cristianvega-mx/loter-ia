// Makes the two downloads: a PDF with every board (one 4 × 3 board per page) and a PDF with the
// 24 cards to cut out (8 per page). Letter paper, landscape. Pictures come from ARASAAC.

import PDFDocument from 'pdfkit';
import { makeBoards } from './boards.js';
import { imageUrl } from './arasaac.js';

const PAGE = { width: 792, height: 612, margin: 24 }; // letter landscape, in points
const COLORS = ['#F5C842', '#7FB3E6', '#E88AA6', '#8FCF9F']; // same colors as the page
const INK = '#1F1A17';
const RED = '#C62D2D';
const CREDIT = 'Pictograms: Sergio Palao. Origin: ARASAAC (arasaac.org). License: CC (BY-NC-SA). Owner: Government of Aragón (Spain).';

// cards: the deck in order ({ name, pictogramId }); a card's color follows its place in the deck.
export async function boardsPdf({ topic, cards, count }, { fetchImage = cachedImage } = {}) {
  const boards = makeBoards(cards, count);
  const pictures = await loadPictures(cards, fetchImage);
  return render(`Loter-IA boards: ${topic}`, doc => {
    const images = openImages(doc, pictures);
    boards.forEach((board, i) => {
      if (i) doc.addPage();
      const area = pageFrame(doc, topic, `Board ${board.number} of ${boards.length}`);
      doc.lineWidth(2.5).roundedRect(area.x, area.y, area.width, area.height, 6).stroke(INK);
      grid(area, 4, 3, 7).forEach((cell, j) => {
        drawCard(doc, cell, board.cards[j], cards, images, { border: true, nameSize: 11 });
      });
    });
  });
}

export async function cardsPdf({ topic, cards }, { fetchImage = cachedImage } = {}) {
  const pictures = await loadPictures(cards, fetchImage);
  const pages = Math.ceil(cards.length / 8);
  return render(`Loter-IA cards: ${topic}`, doc => {
    const images = openImages(doc, pictures);
    for (let page = 0; page < pages; page++) {
      if (page) doc.addPage();
      const area = pageFrame(doc, topic, `Cards ${page + 1} of ${pages}`);
      grid(area, 4, 2, 0).forEach((cell, j) => {
        const card = cards[page * 8 + j];
        if (!card) return;
        doc.save().lineWidth(0.6).dash(4, { space: 3 }).rect(cell.x, cell.y, cell.width, cell.height).stroke('#9A8F82').restore();
        drawCard(doc, inset(cell, 9), card, cards, images, { border: false, nameSize: 14 });
      });
    }
  });
}

// Header (brand, topic, label) and credit line; returns the area left for the grid.
function pageFrame(doc, topic, label) {
  const { width, height, margin } = PAGE;
  const top = margin;
  doc.font('Helvetica-Bold').fontSize(16).fillColor(RED).text('Loter-IA', margin, top, { lineBreak: false });
  doc.fillColor(INK).text(topic, margin + 120, top, { width: width - 2 * margin - 240, align: 'center', lineBreak: false, ellipsis: true });
  doc.fontSize(13).text(label, width - margin - 150, top + 2, { width: 150, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(6.5).fillColor('#555555')
    .text(CREDIT, margin, height - margin - 7, { width: width - 2 * margin, align: 'center', lineBreak: false });
  return { x: margin, y: top + 26, width: width - 2 * margin, height: height - 2 * margin - 26 - 14 };
}

function drawCard(doc, box, card, deck, images, { border, nameSize }) {
  const nameHeight = nameSize + 10;
  const cell = border ? inset(box, 4) : box;
  if (border) doc.lineWidth(1.2).roundedRect(box.x, box.y, box.width, box.height, 4).stroke(INK);
  const art = { x: cell.x, y: cell.y, width: cell.width, height: cell.height - nameHeight };
  const color = COLORS[Math.max(0, deck.indexOf(card)) % COLORS.length];
  doc.roundedRect(art.x, art.y, art.width, art.height, 3).fill(color);
  const picture = images.get(card.pictogramId);
  if (picture) {
    const pad = Math.min(art.width, art.height) * 0.08;
    doc.image(picture, art.x + pad, art.y + pad, { fit: [art.width - 2 * pad, art.height - 2 * pad], align: 'center', valign: 'center' });
  }
  const name = card.name.toLocaleUpperCase();
  doc.font('Helvetica-Bold').fillColor(INK);
  let size = nameSize;
  while (size > 6 && doc.fontSize(size).widthOfString(name) > cell.width - 4) size -= 0.5;
  doc.fontSize(size).text(name, cell.x, art.y + art.height + (nameHeight - size) / 2, { width: cell.width, align: 'center', lineBreak: false });
}

// Each picture is embedded in the PDF once and reused on every board that shows it.
function openImages(doc, pictures) {
  const images = new Map();
  for (const [id, picture] of pictures) {
    try {
      images.set(id, doc.openImage(picture));
    } catch (error) {
      console.warn(`pictogram ${id} could not be read:`, error.message);
    }
  }
  return images;
}

// Splits an area into columns × rows cells with a gap between them (and around them when the gap is > 0).
function grid(area, columns, rows, gap) {
  const width = (area.width - gap * (columns + 1)) / columns;
  const height = (area.height - gap * (rows + 1)) / rows;
  return Array.from({ length: columns * rows }, (_, i) => ({
    x: area.x + gap + (i % columns) * (width + gap),
    y: area.y + gap + Math.floor(i / columns) * (height + gap),
    width,
    height,
  }));
}

const inset = (box, by) => ({ x: box.x + by, y: box.y + by, width: box.width - 2 * by, height: box.height - 2 * by });

function render(title, draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 0, info: { Title: title, Author: 'Loter-IA' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      draw(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Each distinct pictogram once; a picture that can't be fetched leaves its card with just the color and name.
async function loadPictures(cards, fetchImage) {
  const pictures = new Map();
  await Promise.all([...new Set(cards.map(card => card.pictogramId))].map(async id => {
    try {
      pictures.set(id, await fetchImage(id));
    } catch (error) {
      console.warn(`pictogram ${id} skipped in PDF:`, error.message);
    }
  }));
  return pictures;
}

// Pictograms change rarely, so the server keeps the last few hundred it fetched.
const cache = new Map();
async function cachedImage(id) {
  if (cache.has(id)) return cache.get(id);
  const response = await fetch(imageUrl(id), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`ARASAAC answered ${response.status}`);
  const picture = Buffer.from(await response.arrayBuffer());
  cache.set(id, picture);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return picture;
}
