---
doc: spec
status: approved
---

# Loter-IA — Technical Spec

## How This Works, In Plain Language
Loter-IA has three parts:

1. **The page** — what the teacher sees in the browser: the start (topic and language), the deck of 24 cards, the boards, and the caller. Printing uses the browser's own Print button, so boards and cards come out on paper or as a PDF.
2. **The server** — a small program that runs on a computer: Cristian's PC while we build, and his VPS for the public link. It keeps the Amazon key private, asks Amazon's text AI for the concepts, and finds a pictogram for each one.
3. **Two outside services:**
   - **Amazon Nova**, a text AI. It chooses the concepts and writes their names in the teacher's language. It's paid from Cristian's AWS credit, at less than a cent per Lotería.
   - **ARASAAC**, a free library of 11,000+ pictograms drawn for special education. It needs no key and no account.

An example: the teacher types "the solar system" and picks Spanish.
1. The page sends that to the server.
2. The server asks Nova for about 36 ideas, each with a Spanish card name like "Saturno" and an English search word like "Saturn".
3. For each idea, the server asks ARASAAC for the matching pictogram, using the English word because it is less ambiguous ("cometa" is both a comet and a kite in Spanish).
4. It keeps the first 24 ideas that have a pictogram and holds the rest as spares for the "regenerate" button.
5. The page shows the 24 cards.

Everything lives in the page while it's open; nothing is saved.

Why this shape: there is nothing to store, so there is no database. The pictograms are free and always drawn correctly, so no image generation is needed. And without frameworks or npm packages, there are fewer pieces that can break.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Topic and language.** The teacher types a topic and picks a language on the Start view. The page checks that the topic isn't empty, then sends `POST /api/deck {topic, language}` and shows "Creating your Lotería…".
2. **Choosing concepts.** The server checks the daily limit, then asks Nova for about 36 candidate concepts through the Converse API with a forced tool, `propose_concepts`. Each candidate has a card name in the chosen language and two or three English search terms.
3. **Finding pictograms.** For each candidate, the server calls ARASAAC's exact search (`bestsearch`), then the broad search if that finds nothing, keeping only pictograms that carry the term as a keyword. It collects up to three picture options with ARASAAC's own description of each (keywords, meaning, categories), because words have several meanings ("earth" is garden soil and the planet). It runs at most 6 lookups at a time, retries a failed lookup once, and drops pictograms marked as violent or sexual.
4. **Reviewing the cards.** Nova gets a second look through a forced tool, `review_cards`. For each candidate it picks the picture option that shows the title's meaning in this topic, drops misfits (off-topic, unsuitable, no fitting picture), and corrects the name (spelling, accents, article, gender). *(Added in the build; see checklist Revisions.)*
5. **Assembling the deck.** The first 24 reviewed cards with distinct names and pictograms become the deck and the rest become spares. If fewer than 24 are ready, the server asks Nova again, excluding the ideas it already tried, up to three rounds in total. If there are still fewer than 24, it answers with the "topic too narrow" error.
6. **Showing the deck.** The page shows 24 cards. Each card's image loads straight from ARASAAC (`static.arasaac.org`), with the name printed in a band below it.
7. **Regenerating a card.** The page swaps that card for the next spare instantly. When the spares run out, it asks `POST /api/more {topic, language, exclude}` for more.
8. **Boards.** The teacher enters how many boards, from 1 to 60. `boards.js` builds that many boards of 12 different cards each, and no two boards share the same set of cards. Printing shows one board per landscape page.
9. **Printed cards.** "Print cards" lays out all 24 cards, 8 per landscape page, with light cut lines.
10. **The caller.** "Call cards" shuffles the 24 cards and opens a full-screen vertical feed with one card at a time. Swiping or scrolling moves to the next or previous card, and the arrow keys do the same. After the 24th card, an end card says that all the cards have been called.

## Stack
- **Node.js 24** (Cristian's PC has v24.19.0). It covers built-in `fetch`, `--env-file` for settings, and `node --test` for tests. Docs: https://nodejs.org/docs/latest-v24.x/api/
- **Plain JavaScript (ES modules), HTML, and CSS.** There is no framework, no build step, and no npm dependencies. Rationale: less to install and nothing to compile, and the code stays readable for a beginner.
- **Amazon Bedrock Converse API** with a Bedrock API key sent as a bearer token.
  - **Model:** `us.amazon.nova-2-lite-v1:0` (Nova 2 Lite, set with `NOVA_MODEL_ID`). The plan started with Nova Pro, Puente's model, but the build's coverage check showed Nova 2 Lite stays on topic far better; see checklist Revisions.
  - **Docs:** Converse (https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), API keys (https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html), tool use (https://docs.aws.amazon.com/nova/latest/userguide/tool-use.html).
- **ARASAAC API** for pictograms. Docs: https://arasaac.org/developers/api. Terms: https://arasaac.org/terms-of-use.
- **Docker** (`node:24-alpine`) on Cristian's VPS for the public link, behind the Traefik proxy that already serves Puente.
- **Recommendation status:** the agent recommended this architecture (page, server, Nova) in plain language. Cristian accepted the pictograms and the public link during the interview and the rest at review.

## Where It Runs and How Someone Tries It
- **Locally:**
  1. Create `.env` from `.env.example` with `AWS_BEARER_TOKEN_BEDROCK` and `AWS_REGION=us-east-1`. The key is copied from Puente's private settings and never committed.
  2. Run `npm start`.
  3. Open http://localhost:3000.
  4. Run `npm test` for the tests (no network or key needed).
  5. Run `npm run coverage` to check pictogram coverage on six school topics with the real services (the Plan B check; a fraction of a cent per topic).
- **Public link (Cristian's choice):** a Docker container on the VPS with Traefik labels, like Puente, at a subdomain of the existing wildcard domain (for example `loter-ia.za0tzv.easypanel.host`). The key goes in the container's environment. A daily limit protects the credit; see *Daily Limit*.
- **Demo video (required, under 3 minutes, English):** recorded from the running app with a scripted browser and English text-to-speech narration, showing the "What 'Working' Looks Like" steps with "the solar system". Details are handled in `6-ship`.
- **Public repository (required):** code, README with run steps and ARASAAC credit, MIT `LICENSE`, and `devpost/` planning docs. Pictograms are not stored in the repo.

## Look and Feel
Carried from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

- **Palette:**
  - Card backgrounds cycle through light yellow `#F5C842`, blue `#7FB3E6`, pink `#E88AA6`, and green `#8FCF9F`.
  - Accents are red `#C62D2D`, deep blue `#2F6DB5`, and green `#2F8A57`.
  - The background is paper `#FBF6EC` and the text is ink `#1F1A17`.
- **Typography:** card names and headings use Anton, a tall, condensed Google Font under the OFL license, falling back to Arial Black or Impact. Interface text uses the system font.
- **Cards:**
  - A white card with a thin border and a colored picture area (4:5), with the pictogram centered at about 80% of its width.
  - The name is in uppercase with its natural article ("EL SOL", "SATURNO") in a white band below.
  - Pictograms that bring their own background (planets on black) are shown as they are.
- **Interface copy:** English, short and friendly. For example: "Create my Lotería", "Regenerate", "How many boards?", "Print boards", "Print cards", "Call cards".
- **Density:** spacious, with large buttons for a tablet or phone.
- **Print:** print styles hide buttons and menus. Boards print one per landscape page with a small header ("Loter-IA · the solar system · Board 3"); cards print 8 per landscape page.
- **Credit line (required by ARASAAC's license):** "Pictograms: Sergio Palao. Origin: ARASAAC (https://arasaac.org). License: CC BY-NC-SA. Owner: Government of Aragón (Spain)." It appears on screen and on printed pages, in small type.

## Components

### Server
`server.js`. It serves `public/`, answers `POST /api/deck` and `POST /api/more`, checks the daily limit, and reads its settings from the environment. It returns JSON errors with a plain message for the page to show.
PRD ref: `prd.md > Creating the Lotería`, `prd.md > Regenerating a Card`, `prd.md > States and Boundaries`.

### Concept Picker
`lib/nova.js`. It calls Converse with the forced tool `propose_concepts`. The prompt rules:
- concrete things that can be pictured;
- right for a classroom and all different from each other;
- names in the chosen language, with the natural article in the style of classic Lotería;
- one to three simple English search words (singular nouns first);
- nothing from the exclude list.

It returns `[{name, search}]`.

`reviewCards` (same file) is the second look: through the forced tool `review_cards` it returns, for each candidate, whether to keep it, which picture option fits the topic, and the corrected name. *(Added in the build.)*
PRD ref: `prd.md > Creating the Lotería`.

### Pictogram Finder
`lib/arasaac.js`. For each English search term it tries the exact search, then the broad search, and keeps only pictograms that carry the term as a keyword. It skips pictograms marked `violence` or `sex`, retries a failed lookup once, and returns up to three options `{pictogramId, image, term, about}`, where `about` is ARASAAC's description of the picture. An empty list means no picture.
PRD ref: `prd.md > Creating the Lotería`, `prd.md > Look and Feel`.

### Deck Builder
`lib/deck.js`. It combines the two above:
- runs the candidates through the finder, at most 6 at a time (one failed lookup only loses that concept; if most fail, it reports the picture service as down);
- has the reviewer choose each card's picture, drop misfits, and fix names (if the review fails, the cards keep their first picture);
- keeps 24 cards with distinct names and pictograms and holds the rest as spares;
- asks for more, up to three rounds, if short;
- reports "topic too narrow" when it still can't reach 24.

PRD ref: `prd.md > Creating the Lotería`, `prd.md > Regenerating a Card`.

### Daily Limit
`lib/limit.js`. It keeps in-memory counters per calendar day (UTC) for decks and "more" requests. The defaults are 100 decks and 300 "more" requests a day, set with `DAILY_DECKS` and `DAILY_MORE`. When a counter is reached, the server answers "Loter-IA has reached today's limit. Please try again tomorrow." The counters reset each day and on restart.
PRD ref: `prd.md > States and Boundaries`.

### The Page
`public/index.html`, `public/app.js`, `public/styles.css`. There are three views in one page: Start, Deck, and Caller.
- The page keeps the deck, spares, boards, and caller order in memory.
- It shows the "creating" state and the error messages, with "Try again" keeping the topic.
- Every card on the Deck view has a "Regenerate" button.

PRD ref: `prd.md > Screens and Layout`, `prd.md > The Core Journey`.

### Boards
`public/boards.js`. It has pure functions:
- `shuffle` (Fisher–Yates);
- `makeBoards(cards, count)`, which builds boards of 12 cards and redraws any board whose set of cards was already used.

PRD ref: `prd.md > Boards`.

### Print Layouts
The `@media print` rules in `public/styles.css`, plus two print containers the page fills before calling `window.print()`: `#print-boards` and `#print-cards`.
PRD ref: `prd.md > Boards`, `prd.md > Printing the Cards`.

### Caller
Part of `public/app.js` and `public/styles.css`. It is a full-screen vertical feed using CSS scroll-snap, so swiping, a mouse wheel, or a trackpad move between cards natively. The arrow keys, Page Up and Page Down, and the space bar move it too. It ends with an end card, and has a "Back to deck" button.
PRD ref: `prd.md > Calling the Cards on Screen`.

## Data Model
All shapes are plain JavaScript objects.

- **Card** — `{ name: "Saturno", search: "Saturn", pictogramId: 10300, image: "https://static.arasaac.org/pictograms/10300/10300_500.png" }`
- **Deck** — `{ topic, language, cards: Card[24], spares: Card[] }`
- **Board** — `{ number, cards: Card[12] }`
- **Caller** — `{ order: Card[24], position }`
- **Daily counters** (server) — `{ day: "2026-10-05", decks: 12, more: 30 }`

| Data | Where it lives | How it changes | When the teacher leaves and comes back |
|---|---|---|---|
| Deck and spares | Page memory | Created by "Create my Lotería"; a card is swapped by "Regenerate" | Gone; they make a new Lotería (PRD: nothing is saved) |
| Boards | Page memory | Rebuilt each time the teacher asks for boards | Gone |
| Caller order and position | Page memory | Shuffled when the caller opens; position moves with each swipe | Gone |
| Daily counters | Server memory | +1 per deck or "more" request | Survive until the day changes or the server restarts |
| Amazon key | `.env` (local) or container environment (VPS) | Set once by hand | Stays; never sent to the page |

## File Structure

```
loteria-bilingue/            # project folder (the public repo can be named loter-ia)
├── server.js                # small web server: serves public/, answers /api/deck and /api/more
├── lib/
│   ├── nova.js              # asks Amazon Nova for concepts (Converse API, forced tool)
│   ├── arasaac.js           # finds a pictogram for an English search word
│   ├── deck.js              # candidates → 24 cards + spares, retry once, "topic too narrow"
│   └── limit.js             # daily counters for the public link
├── public/
│   ├── index.html           # the app: Start, Deck, and Caller views + print containers
│   ├── app.js               # page logic: create, regenerate, boards, printing, caller
│   ├── boards.js            # shuffle and makeBoards (pure functions, shared with tests)
│   └── styles.css           # Lotería look, caller feed, print layouts
├── test/
│   ├── boards.test.js       # 12 different cards per board, no two boards alike, shuffle
│   ├── deck.test.js         # deck assembly with fake Nova and ARASAAC answers
│   └── arasaac.test.js      # exact search first, keyword match, picture options, retry (fake fetch)
├── scripts/
│   └── coverage.js          # Plan B check: real decks for six school topics (npm run coverage)
├── Dockerfile               # node:24-alpine image for the public link
├── .env.example             # AWS_BEARER_TOKEN_BEDROCK=, AWS_REGION=us-east-1, NOVA_MODEL_ID=, DAILY_DECKS=, DAILY_MORE=
├── .gitignore               # already ignores .env, learner profile, Spanish review pages
├── package.json             # "start": "node --env-file-if-exists=.env server.js", "test": "node --test"
├── LICENSE                  # MIT (code only; pictograms keep ARASAAC's license)
├── README.md                # what it is, how to run, public link, video, ARASAAC credit
└── devpost/                 # planning docs (scope, prd, spec, checklist)
```

## External Services and Dependencies

### Amazon Bedrock — Nova 2 Lite (Converse API)
- **Call:** `POST https://bedrock-runtime.us-east-1.amazonaws.com/model/us.amazon.nova-2-lite-v1:0/converse`, twice per round: once with `propose_concepts` (below) and once with `review_cards` (`{cards: [{number, keep, picture, name}]}`).
- **Auth:** header `Authorization: Bearer <AWS_BEARER_TOKEN_BEDROCK>`.
- **Payload:**
  ```json
  {
    "system": [{ "text": "<rules for Lotería concepts>" }],
    "messages": [{ "role": "user", "content": [{ "text": "Topic: the solar system\nLanguage: Spanish\nHow many: 36\nAvoid: <names already tried>" }] }],
    "inferenceConfig": { "maxTokens": 2500, "temperature": 0.7 },
    "toolConfig": {
      "tools": [{ "toolSpec": {
        "name": "propose_concepts",
        "description": "Concepts for a classroom Lotería deck",
        "inputSchema": { "json": {
          "type": "object",
          "properties": { "concepts": { "type": "array", "items": {
            "type": "object",
            "properties": { "name": { "type": "string" }, "search": { "type": "array", "items": { "type": "string" } } },
            "required": ["name", "search"] } } },
          "required": ["concepts"] } }
      } }],
      "toolChoice": { "tool": { "name": "propose_concepts" } }
    }
  }
  ```
- **Response:** `output.message.content[]` → the block with `toolUse.input.concepts`.
- **Cost:** Nova 2 Lite (US inference profile) is about $0.33 per million input tokens and $2.75 per million output tokens (https://cloudprice.net/models/amazon.nova-2-lite-v1%3A0; confirm on AWS's pricing page). A deck takes one to three rounds of two calls of a few thousand tokens each, so under 1 cent. It's paid from the AWS credit because it's Amazon's own model. Pricing: https://aws.amazon.com/bedrock/pricing/
- **Checked 2026-09-30:** the key reaches Nova in `us-east-1`. Nova Canvas image generation is "Legacy" and blocked for this account, which is why it's not used.

### ARASAAC API (pictograms)
- **Exact search:** `GET https://api.arasaac.org/v1/pictograms/en/bestsearch/{word}` returns `[{_id, keywords, violence, sex, …}]`, or 404 when there's no match.
- **Broad search:** `GET https://api.arasaac.org/v1/pictograms/en/search/{word}` returns the same shape.
- **Image:** `https://static.arasaac.org/pictograms/{id}/{id}_500.png` (PNG, 500 px). The page loads it directly.
- **Access:** no key and free.
- **License:** CC BY-NC-SA 4.0, which allows non-commercial use with credit. The credit line appears on screen, in prints, and in the README.
- **Checked 2026-09-30:**
  - The API answers in English, Spanish, and Arabic.
  - "comet" finds the comet (2711) and "kite" the kite (2350).
  - "Milky Way" and "black hole" find nothing, which is why the server over-asks for candidates.

### Plan B: Cloudflare Workers AI drawings (only if pictograms fall short)
Cristian's fallback, decided at review. It is not built unless the coverage check fails (see *Decisions and Open Issues*).
- **Call:** `POST https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`
- **Auth:** header `Authorization: Bearer {CLOUDFLARE_API_TOKEN}`.
- **Payload:** `{ "prompt": "<flat cartoon drawing of ONE {English word}, centered, thick outlines, flat colors, plain background, no text>", "steps": 4 }`
- **Response:** `result.image`, a base64 JPEG. The server would send it to the page as a data URL instead of an ARASAAC link.
- **Free allowance:** 10,000 Neurons a day, about 170 images at 1024 px, or about 7 Loterías a day. The daily limit would drop to match. Docs: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/ and https://developers.cloudflare.com/workers-ai/platform/pricing/
- **Needs:** Cristian creates a free Cloudflare account and an API token himself, then pastes them into `.env`. Drawings take a few seconds each and can come out wrong, which "Regenerate" helps with.

## Important Failure Modes
- **Not enough pictograms for the topic** → one extra request for ideas. If there are still fewer than 24, the page says: "This topic doesn't have enough pictures yet. Try a broader topic." (`prd.md > States and Boundaries`)
- **Ambiguous words** (cometa means both comet and kite) → searches use Nova's specific English words and try the exact match first.
- **Amazon AI fails or takes over 30 seconds** → the page says: "Something went wrong while creating your Lotería." A "Try again" button keeps the topic.
- **ARASAAC is down or slow** → the same message and retry. A picture that fails to load shows its name on the colored background.
- **Daily limit reached on the public link** → the page says: "Loter-IA has reached today's limit. Please try again tomorrow."

## What Was Simplified and Why
- **Pictograms instead of AI-generated drawings** (Cristian's decision). This keeps the cost at zero and the drawings correct. The fuller version, drawings of anything, would need a paid image model (Stability, about $1 per Lotería) or a separate free account (Cloudflare Workers AI).
- **Browser printing instead of generating PDFs.** Print to paper, or use "Save as PDF", with no PDF library.
- **Nothing saved** (PRD). There is no database, no accounts, and no files written.
- **An in-memory daily counter instead of per-person quotas.** It's enough to protect the credit on the public link without sign-in.
- **No framework and no dependencies.** It's one small Node server and one page.

## Decisions and Open Issues

**Cristian's decisions in this step:**
- **Free pictograms (ARASAAC) instead of paid AI drawings** — "no me gustaría gastar más de lo que tengo de crédito". Tradeoff accepted: only concepts that have a pictogram can become cards, and some pictograms bring their own background.
- **Video plus a public link** — after learning the link is optional, he chose it so judges can try Loter-IA themselves, with a daily limit to protect the credit.
- **Plan B for drawings** — "si ves que no alcanza con los dibujos de ARASAAC cambiemos a la IA de Cloudflare". The first build step checks pictogram coverage with "the solar system" and five common school topics. If the demo topic can't reach 24 good pictograms, or most of the other topics can't, the build switches to Cloudflare Workers AI drawings (see *Plan B*).

**Agent recommendations** (explained in plain language, accepted at review): the three-part shape (page, server, Nova) and Nova as the text AI (Nova Pro in the plan; Nova 2 Lite after the build's coverage check).

**Implementation details derived by the agent:**
- Node 24 plain JavaScript with zero dependencies.
- About 36 candidates per deck, English searches with the exact match first, and the violence and sex filters.
- A 1–60 range for boards.
- One board per landscape page and 8 cards per landscape page.
- Daily limits of 100 decks and 300 "more" requests.
- The Anton font.

**One useful unknown** (from Cristian): in `2-scope` he asked why the pictures wouldn't have letters when classic Lotería cards show the name. It was clarified then: the app prints each name itself, and the drawing (now a pictogram) carries no text. That way names are always spelled right and come out in the chosen language. The build checks it by creating decks in two languages: the pictures carry no letters, and the name bands appear in each chosen language.

**Open issues:**
- **Board orientation:** "4 × 3" is read as 4 columns by 3 rows on a landscape page. Confirm when Cristian sees the first printed board; it's quick to flip.
- **Card languages:** Spanish, English, French, Portuguese, German, and Italian, still the PRD's assumption.
- **Public link:** the subdomain is chosen at deploy time.
- **Verify first in the build:**
  - Nova's forced-tool output with this key for a Lotería prompt. *(Done in slice 1: works with Nova Pro and Nova 2 Lite.)*
  - That "the solar system" reaches 24 pictograms, plus the Plan B coverage check.
  - The Anton font license file, if the font is self-hosted.
