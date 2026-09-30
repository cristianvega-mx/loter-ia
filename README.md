# Loter-IA

Turn any class topic into a ready-to-print Lotería (Mexican picture bingo). A teacher types what the class is learning, picks the card language, and gets 24 picture cards made with ARASAAC pictograms.

The name joins *Lotería* and *IA*, Spanish for AI.

## Run it

You need Node.js 24 and an Amazon Bedrock API key with access to Amazon Nova.

```bash
cp .env.example .env      # then paste your key into .env
npm start                 # open http://localhost:3000
npm test                  # runs the tests; no network or key needed
```

## How it works

- **The page** (`public/`) is where the teacher types the topic and sees the cards.
- **The server** (`server.js`, `lib/`) keeps the Amazon key private. It asks Amazon Nova for concepts (`lib/nova.js`), finds a pictogram for each one (`lib/arasaac.js`), and assembles 24 cards plus spares (`lib/deck.js`).

The planning documents behind this build are in [`devpost/`](devpost/). They were written with the Devpost Learn Skill Pack.

## Credits

Pictograms: Sergio Palao. Origin: [ARASAAC](https://arasaac.org). License: CC (BY-NC-SA). Owner: Government of Aragón (Spain). The pictograms are loaded from ARASAAC and are not part of this repository.

## License

The code is MIT licensed; see [LICENSE](LICENSE).
