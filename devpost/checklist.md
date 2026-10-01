---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Type a topic and get a 24-card Lotería**
  Becomes usable: At http://localhost:3000 the teacher types a topic, picks the card language, and presses "Create my Lotería". They see "Creating your Lotería…", then 24 cards, each an ARASAAC pictogram with its name in the chosen language, in the Lotería look and with the ARASAAC credit line.
  Why now: This is the unique kernel. It also carries the two biggest risks: whether Nova picks good concepts, and whether pictograms cover the topics (the Plan B decision). Project bootstrapping is included.
  PRD ref: `prd.md > The Core Journey` (steps 1–3), `prd.md > Creating the Lotería`, `prd.md > Look and Feel`
  Spec ref: `spec.md > The Core Journey Through the System`, `spec.md > Server`, `spec.md > Concept Picker`, `spec.md > Pictogram Finder`, `spec.md > Deck Builder`, `spec.md > The Page`, `spec.md > Look and Feel`, `spec.md > External Services and Dependencies`, `spec.md > File Structure`
  Build: Scaffold per the file structure: `package.json` with start and test scripts, `.env.example`, a starter README, an MIT LICENSE, and `.gitignore` entries for the installed skill pack. Copy the Bedrock key from Puente's private settings into `.env` without printing it. Implement `lib/nova.js` (forced tool), `lib/arasaac.js` (exact search, then broad search, with filters), `lib/deck.js` (36 candidates → 24 cards plus spares, one retry), `server.js` (static files and `POST /api/deck`), and the Start and Deck views with the loading state, the card design, and the credit line. Add `scripts/coverage.js`, which runs the deck builder on six topics and reports how many cards each reached.
  Verify (mechanical): `npm test` passes (deck and pictogram-finder tests with fake answers). `npm start` runs without errors. `POST /api/deck` for "the solar system" in Spanish returns 24 cards with unique pictogram ids and Spanish names. `node scripts/coverage.js` shows 24 for "the solar system" and for most of: farm animals, fruits and vegetables, the human body, jobs, the weather; otherwise switch to Plan B as a recorded revision. A browser screenshot shows the 24 cards rendered.
  Learner check: Open http://localhost:3000, type "the solar system", pick Spanish, press "Create my Lotería", and say whether the cards look like the Lotería you pictured.
  Commit: `Create a 24-card Lotería from a topic`

- [x] **2. Swap a card you don't like**
  Becomes usable: Every card has a "Regenerate" button. It replaces only that card with a different concept from the same topic: instantly from the spares, or by asking the server for more once the spares run out.
  Why now: It answers the kernel's main risk, a wrong or unwanted card, and builds directly on the deck from slice 1.
  PRD ref: `prd.md > Regenerating a Card`
  Spec ref: `spec.md > Deck Builder`, `spec.md > Server`, `spec.md > The Page`, `spec.md > Data Model`
  Build: Add the Regenerate button, swap in the next spare, and add `POST /api/more` with the exclude list for when the spares run out.
  Verify (mechanical): A test confirms that regenerating never repeats a concept or pictogram already in the deck and leaves the other 23 cards unchanged. With the spares emptied, `/api/more` returns cards that are not in the exclude list. A browser run clicks Regenerate and confirms that exactly one card changed.
  Learner check: Press "Regenerate" on a card you don't like and check that a different card takes its place while the rest stay the same.
  Commit: `Regenerate a single card`

- [x] **3. Print the boards and the cards**
  Becomes usable: The teacher chooses how many boards (1–60) and prints them: one 4 × 3 board per landscape page, all different. The teacher can also print the 24 cards, 8 per page, to cut out.
  Why now: Paper boards are how the class actually plays. With the deck settled, printing is the next step of the journey.
  PRD ref: `prd.md > Boards`, `prd.md > Printing the Cards`, `prd.md > The Core Journey` (steps 5–6)
  Spec ref: `spec.md > Boards`, `spec.md > Print Layouts`, `spec.md > Look and Feel`
  Build: Implement `public/boards.js` (shuffle, and makeBoards with unique card sets), the "How many boards?" control, and the print containers with `@media print` layouts, headers, and the credit line.
  Verify (mechanical): The board tests pass: 12 different cards per board, no two boards alike, and the requested count. A scripted browser prints to PDF: 3 boards give 3 landscape pages, the cards give 3 pages, and no buttons appear in either PDF.
  Learner check: Ask for 3 boards, press "Print boards", and look at the print preview (you can choose "Save as PDF"); then do the same with "Print cards".
  Commit: `Print boards and cards`

- [x] **4. Call the cards on screen**
  Becomes usable: "Call cards" opens a full-screen feed with the 24 cards shuffled, one at a time. Swiping, the mouse wheel, or the arrow keys move to the next or previous card, an end card says all cards have been called, and "Back to deck" returns to the deck.
  Why now: It completes the core journey (step 7) using the finished deck.
  PRD ref: `prd.md > Calling the Cards on Screen`, `prd.md > States and Boundaries` (end of the deck)
  Spec ref: `spec.md > Caller`, `spec.md > Data Model`
  Build: Build the caller view with CSS scroll-snap, a shuffle on opening, keyboard support, the end card, and the back button.
  Verify (mechanical): A scripted browser opens the caller, presses the down arrow 24 times, and reaches the end card. Two openings give different orders. The shuffle test passes.
  Learner check: Press "Call cards", swipe or scroll through a few cards and back, then go to the end.
  Commit: `Call cards on screen`

- [x] **5. Friendly messages and a daily limit**
  Becomes usable:
  - Clear messages for an empty topic, a topic too narrow, and failures, with "Try again" keeping the topic.
  - A card whose picture fails to load shows its name on its color.
  - The server stops politely after the daily limit.
  - The app is packaged for the public link: a Dockerfile and README run steps.
  Why now: It makes the app safe to share before shipping; the judges' link needs the limit and the messages.
  PRD ref: `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > Daily Limit`, `spec.md > Where It Runs and How Someone Tries It`
  Build: Add topic validation and error messages, retry, the image fallback, `lib/limit.js` wired into both endpoints, the Dockerfile, and the README run and credit sections.
  Verify (mechanical): Tests confirm the limit (request N+1 is refused) and the deck errors with fake failures. A server run with `DAILY_DECKS=1` refuses the second deck with the message. A browser run shows the right messages for an empty topic and a nonsense topic. The Docker image builds on the VPS (build only; nothing is published).
  Learner check: Try creating with an empty topic, then with a nonsense topic like "zzzz", and read the messages.
  Commit: `Add friendly errors and daily limit`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 1 (the deck): the look and the pictures, while printing and calling can still adapt
  Feedback: Cristian tried "animals" in English and liked the result ("me parece muy bien"). He noticed the boards were still missing (planned in slice 3). His first try showed "Failed to fetch" because the local server had been stopped; the unclear message is covered in slice 5.
- [x] Final kick-the-tires exploration and feedback completed
  Feedback: Cristian was invited to try the whole journey on his own: create a Lotería, regenerate a card, download both PDFs, call the cards, and try an empty topic and a nonsense one. His report: "así está bien, me gustó mucho" ("it's good as it is, I liked it a lot"). He asked for no changes.

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship
  Outcome: no changes were requested, so there were no revisions to make. `npm test` passed (37 tests) and the app was running at http://localhost:3000 when he confirmed.
  Known limits he was told about before confirming: a topic with too few pictograms gets the "try a broader topic" message (for example "dinosaurs"), the AI sometimes picks the wrong article for a name (Regenerate replaces that card), and a Lotería takes 15 to 40 seconds to create.

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: A brief recap, not hands-on practice. No learning goal was established, so the default route was used: follow "Create my Lotería" from the button to the cards on screen. The three stops were sent to Cristian in Spanish with links to the real files, together with the takeaway that seeing the app work early changed the printing plan (see `## Revisions`: PDF downloads instead of the print window). He read it and chose to move on to shipping ("sigamos, todo está bien"). He did not report opening the files, so no stop is recorded as followed. The map was checked by a script (every path, search text, and code excerpt matches the source at commit 1c70196) and rendered in a browser in both languages, at desktop and phone widths, and with a dark theme. It is one page in English and Spanish, so it is committed while the Spanish review pages stay local.
Route and stops: `public/app.js` > `$('start-form').addEventListener('submit', …)` → on the way, `server.js` > `'/api/deck'` → `lib/deck.js` > `buildDeck` → `public/app.js` > `cardElement`. A reference route; it was not toured interactively.
Edit outcome: Offered and not taken up — the number of boards the page suggests stays at 30 (`public/index.html`, `id="board-count"`). No code changed.
Reflection: Offered; he answered briefly. His answer is kept in the private learner profile.
Activity mode: Recap — a static walkthrough in the chat with links to the source files, rather than a live editor session, plus the app map.

## Revisions

- Nova 2 Lite replaced Nova Pro as the text model — in the coverage check Nova Pro filled "farm animals" with lions and elephants and reached only 21 solar-system cards, while Nova 2 Lite stayed on topic.
- Added an AI review pass (`reviewCards`) that picks the right picture among up to three options, drops misfits, and corrects names — the first decks showed the planet Earth as garden soil, a jewelry ring, and Spanish errors ("El cabra", "El Mercurio").
- Pictograms must carry the search term as a keyword, and the deck builder asks for up to three rounds of ideas — single-word searches matched a fairy-tale dwarf for "dwarf planet", and two rounds were not always enough for "the solar system".
- ARASAAC lookups retry once, and a single failed lookup only loses that concept — a dropped connection failed a whole test run.
- Added `scripts/coverage.js` (`npm run coverage`) as the Plan B check — all six school topics reached 24 cards, so Plan B (Cloudflare drawings) is not needed.
- Boards and cards now download as PDFs made on the server with PDFKit, instead of opening the browser's print window — Cristian asked for one file with all the boards, which is easier to save, send, and take to a print shop. `public/boards.js` moved to `lib/boards.js`, and the print styles were removed.
- The shuffle moved to `public/shuffle.js` — both the caller in the page and the boards on the server need it, and the page can only load files from `public/`.
- Nova now says whether a topic is suitable, and the app has a message for topics it refuses — a nonsense topic ("zzzz qqqq xxxx") had produced a full deck, and "weapons and guns" sometimes did too.
- The cost statements were corrected after measuring real token counts in `6-ship`: a Lotería costs about one US cent (measured $0.008 and $0.011), not "under one cent" — the README, the spec, and the coverage script said less.
- The license note about the pictograms moved from `LICENSE` to `NOTICE`, so the repository page shows the license as plain MIT — the contest asks for a license that is detectable at the top of the repository.
- The server now throws away the rest of an upload once it passes the size limit — before, an oversized request was refused but kept filling memory, which matters on a public link.
