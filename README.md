# Loter-IA

Turn any class topic into a ready-to-print Lotería (Mexican picture bingo). A teacher types what the class is learning, picks the card language, and gets 24 picture cards made with ARASAAC pictograms, plus a PDF with as many boards as the class needs and a PDF with the cards to cut out.

The name joins *Lotería* and *IA*, Spanish for AI.

**Try it:** https://loter-ia.za0tzv.easypanel.host (a daily limit protects the AI credit, so it may ask you to come back tomorrow).

**Demo video (a minute and a half):** https://youtu.be/pNbD7RqjFEg

**Project page:** https://devpost.com/software/loter-ia

## Run it

You need Node.js 24 and an Amazon Bedrock API key with access to Amazon Nova.

```bash
npm install               # installs PDFKit, the only dependency
cp .env.example .env      # then paste your key into .env
npm start                 # open http://localhost:3000
npm test                  # runs the tests; no network or key needed
```

## Settings

Set these in `.env` (or in the container's environment):

| Setting | What it does | Default |
|---|---|---|
| `AWS_BEARER_TOKEN_BEDROCK` | Amazon Bedrock API key | none (required) |
| `AWS_REGION` | AWS region for Bedrock | `us-east-1` |
| `NOVA_MODEL_ID` | Text model that picks and reviews the cards | `us.amazon.nova-2-lite-v1:0` |
| `PORT` | Port for the web server | `3000` |
| `DAILY_DECKS` | Loterías that can be created per day | `100` |
| `DAILY_MORE` | Extra "Regenerate" requests per day | `300` |

The daily limits protect your AWS credit when the app is on a public link. Creating a Lotería costs about one US cent.

## Run it with Docker

```bash
docker build -t loter-ia .
docker run -p 3000:3000 --env-file .env loter-ia
```

## How it works

- **The page** (`public/`) is where the teacher types the topic, sees the cards, swaps the ones they don't like, and downloads the PDFs.
- **The server** (`server.js`, `lib/`) keeps the Amazon key private. It asks Amazon Nova for concepts (`lib/nova.js`), finds a pictogram for each one (`lib/arasaac.js`), and assembles 24 cards plus spares (`lib/deck.js`). When the ideas fall short, it fills in with what the pictogram library has in the topic's own categories. It also makes the downloads: boards that are all different (`lib/boards.js`) drawn into PDF files (`lib/pdf.js`).

The planning documents behind this build are in [`devpost/`](devpost/). They were written with the Devpost Learn Skill Pack. For a short tour of the code, open [`devpost/app-map.html`](devpost/app-map.html) in a browser; it is in English and Spanish.

## Credits

Pictograms: Sergio Palao. Origin: [ARASAAC](https://arasaac.org). License: CC (BY-NC-SA). Owner: Government of Aragón (Spain). The pictograms are loaded from ARASAAC and are not part of this repository.

## License

The code is MIT licensed; see [LICENSE](LICENSE). The pictograms keep their own license; see [NOTICE](NOTICE).
