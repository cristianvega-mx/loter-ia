---
doc: prd
status: approved
---

# Loter-IA — Product Requirements

An app for teachers that turns any class topic into a ready-to-print Lotería: 24 illustrated cards, as many boards as the class needs, and an on-screen caller. The name joins "Lotería" and "IA" (Spanish for AI).
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`. Scope used the working title "Lotería for Teachers"; Cristian chose the name Loter-IA here.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. The teacher opens Loter-IA, types the topic of the lesson (for the demo: "the solar system"), and picks the language for the cards.
2. They ask it to create the Lotería. While it works, the screen shows that the Lotería is being made.
3. The deck appears: 24 cards, each with a drawing and its name in the chosen language.
4. If a card came out wrong or the teacher doesn't like it, they press that card's "regenerate" button, and it is replaced by a different card from the same topic.
5. The teacher enters how many boards the class needs. Loter-IA makes that many boards of 4 × 3 (12 squares), all different, and downloads them as one PDF file.
6. The teacher prints the PDF (at home, at school, or at a print shop) and hands the boards out. Students mark their boards by hand.
7. The teacher calls the cards either from the printed deck (Loter-IA makes a PDF of the 24 cards too) or on screen, one card at a time: swipe up for the next card, swipe down to go back to the previous one. They shout each card's name; students look for the card with that drawing and name on their board.

Success: a complete, illustrated Lotería on the topic the teacher typed, played on paper in class.

## Screens and Layout
The journey uses three parts of the app, plus the PDF files it downloads. Whether Start and Deck are one page or two is not decided; `4-spec` picks the simplest.

- **Start** — type the topic, pick the card language, create the Lotería.
- **Deck** — the 24 cards, each with its "regenerate" button; where the teacher enters the number of boards; the ways to download the boards, download the cards, and start calling cards on screen.
- **Caller** — one card at a time, with its drawing and name; swipe up for the next card, swipe down for the previous one.
- **PDF files** — one with all the boards (4 × 3 each, one per page) and one with the 24 cards to cut out.

## Look and Feel
Source: `scope.md > Inspiration & Identity`.

- **Cards look like classic Lotería cards:** the drawing, with its name printed by the app in its own band below it — "like the normal Lotería that has the picture and the name." Reference: Cristian's photo of classic cards (El Pájaro, La Mano, La Luna…).
- **Drawing style: "the one that's simplest for the AI"** (Cristian's criterion). The agent translated it into a flat, cartoon-like drawing of a single object in the center, with thick outlines, flat colors, and a one-color background like the colored backgrounds of classic cards. All 24 drawings share this style so they look like one deck. No letters inside the drawings.
- **Update from `4-spec`: the drawings are ARASAAC pictograms.** To stay within his AWS credit, Cristian chose free pictograms from ARASAAC (11,000+ pictograms drawn for special education) instead of paid AI-generated drawings. Their flat style with thick outlines fits the direction above; a few come with their own background (planets on a black sky).
- **App colors:** classic Lotería colors (yellow, blue, pink, red, green) on a paper-colored background. This is the agent's proposal, shown for review.
- **Interface language:** English, "the ideal language for the contest." Card names follow the language the teacher picks.

## Features and Behavior

### Creating the Lotería
Source: `scope.md > The POC Boundary`.

The teacher types a topic and picks the card language; Loter-IA creates a deck of 24 cards about that topic.

- [ ] Typing "the solar system", picking a language, and creating the Lotería shows 24 cards, each with a drawing and a name.
- [ ] The 24 cards are 24 different concepts from the topic, with no repeats.
- [ ] Each name is in the language the teacher picked, and the drawings contain no letters.
- [ ] While the Lotería is being created, the screen shows that it's working instead of looking frozen.
- [ ] The card language can be picked from the most common teaching languages. The list is an assumption; see Open Questions.

### Regenerating a Card
Source: `scope.md > Open Questions and Risks` (pictures must be right).

Every card in the deck has a "regenerate" button.

- [ ] Pressing it replaces only that card with a different concept from the same topic, with its own drawing.
- [ ] The new concept is not already in the deck, and the other 23 cards stay as they were.

### Boards
Source: `scope.md > The Core Loop`.

- [ ] The teacher enters how many boards they need and gets exactly that many.
- [ ] Each board is 4 × 3: 12 squares, each showing the drawing and name of a different card from the deck.
- [ ] No two boards are the same. (Assumption: inherent to Lotería.)
- [ ] The boards download as one PDF file with one board per page, ready to print, send, or take to a print shop. *(Changed in the build, at Cristian's request: a download instead of the browser's print window.)*

### Printing the Cards
Source: `scope.md > The POC Boundary`.

- [ ] The teacher can download the 24 cards as one PDF, laid out to be cut out and called by hand.

### Calling the Cards on Screen
Source: `scope.md > The Core Loop`.

- [ ] The caller shows one card at a time, with its drawing and name.
- [ ] It moves like a vertical feed (like Reels or TikTok): swiping up shows the next card and swiping down goes back to the previous one. A mouse wheel or trackpad works the same way.
- [ ] The cards come in a shuffled order, different each game. (Assumption: like shuffling the deck.)
- [ ] After the 24th card, the caller says that all the cards have been called. (Assumption.)

## States and Boundaries

- **First use** — the start asks only for a topic and a language; no sign-in.
- **Creating** — while the AI makes the cards, the teacher sees that it's working.
- **A topic that can't be used** — if the topic is empty, or there aren't 24 concepts for it, Loter-IA says so plainly and asks for a different or broader topic. (Assumption.)
- **Something fails while creating** — the teacher sees a clear message and can try again without retyping the topic. (Assumption.)
- **End of the deck** — after the last card, the caller says all 24 cards have been called. (Assumption.)
- **Closing the page** — nothing is saved; closing the page ends that Lotería. (Assumption, accepted in review.)

## Product Decisions

- **24 cards** — the classic 54 felt like too many. He first proposed 44, then chose 24 after considering that few class topics have 44 concepts that can be drawn clearly.
- **Boards of 4 × 3 (12 squares)** — chosen together with the 24-card deck.
- **Regenerate replaces the whole card** — a different concept with its own drawing, not a new drawing of the same concept.
- **Drawing style: the simplest for the AI** — reliable drawings matter more than a particular look (ties to the drawing risk in scope).
- **Interface in English** — "the ideal language for the contest," although he and Mexican teachers speak Spanish. He will test it with the agent translating.
- **Name: Loter-IA** — "Lotería" + "IA" (AI in Spanish).
- **Demo topic: the solar system** — from scope: math drawings would have to be exact.
- **Classic card look** — the drawing plus its name, from his photo (scope).
- **Boards and cards as PDF downloads** (decided in the build) — "que al crear las tablas se las dé dentro de un archivo PDF para descargar": one file with all the boards, easy to save, send, or take to a print shop.
- **Pictograms instead of AI drawings** (decided in `4-spec`) — no spending beyond his AWS credit. Only concepts that have a pictogram can become cards.

## What We're Building

1. Start: topic and card language, then create.
2. A 24-card deck with drawings and names, and a "regenerate" button on each card.
3. Boards: choose how many; 4 × 3, all different; download as one PDF.
4. The 24 cards as a PDF to cut out.
5. The on-screen caller: vertical swipe, shuffled order, end-of-deck message.
6. An English interface, with card names in the chosen language.

## Deferred From the POC

- **Saving a Lotería to play another day** — nothing is saved for now; the demo happens in one sitting. (Assumption, accepted in review.)
- **A Spanish interface** — teachers in Mexico would want it; the proof of concept's interface is in English for the contest.
- **Families playing at home** — from scope: teachers first.

## Possible Later Enhancements

- **Redraw the same concept** — a way to keep a card's concept and get only a new drawing, for when the concept is right but the drawing isn't.

## Non-Goals

- **Students playing on phones or screens** — the fun is physical (cut in scope).
- **Clues or definitions instead of names** — the teacher shouts the name (cut in scope).
- **Accounts or sign-in** — one teacher and one session are enough to prove the idea.
- **Checking winners automatically** — the teacher checks a winning board by hand, as in classic Lotería.

## Open Questions

- **Card languages** — assumed Spanish, English, French, Portuguese, German, and Italian ("the most common for teaching"). Can change anytime; doesn't block `4-spec`.
- **Nothing is saved** — accepted in review as fine for the proof of concept. Resolved.
