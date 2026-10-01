// Talks to Amazon Nova through Bedrock's Converse API, always through a forced tool so the answer is structured.
// proposeConcepts: ideas for the cards (a name in the teacher's language + English words to find the pictogram).
// reviewCards: a second look at the finished cards that drops misfits and corrects the names.

import { DeckError } from './deck.js';

const PROPOSE_SYSTEM = `You choose concepts for a classroom Lotería (Mexican picture bingo). A teacher gives a topic; every concept becomes one card showing a simple pictogram and its name.

Rules:
- Each concept is a concrete thing a simple pictogram can show: an object, animal, plant, food, place, person, body part, or simple action. Skip abstract ideas that can't be drawn.
- List the most typical, recognizable concepts of the topic first. Every concept must clearly belong to the topic. If the topic runs short, add closely related concepts (for "farm animals": the barn, the farmer, the tractor), never unrelated ones (no elephants on a farm).
- All concepts suit school children and differ from each other: no near-duplicates, and no synonym of an earlier concept.
- "name" is the card title in the requested language, spelled correctly, with the article that language naturally uses for it in its correct gender (for example "El Sol", "La Luna", "La cabra", "Saturno" in Spanish; "The Sun" in English). Keep it short.
- "search" lists two or three English search terms used to find the pictogram in a children's pictogram library: the exact name first, then simpler, more common names a child would use for the same thing, all in the singular (for "La Sonda Espacial": "space probe", "spaceship"; for a comet in the sky: "comet", never "kite"). Never split a name into separate words: "black hole", not "black".
- The "Avoid" list holds concepts that are already on cards or have no picture available. Never repeat them or their synonyms; choose other concepts of the topic, including simpler and more common ones, and related people, tools, places, and events.
- "suitable" is false when the topic is not a real subject (random letters, nonsense) or is not appropriate for a school classroom (weapons, drugs, sexual or violent content); then return no concepts. Otherwise it is true.
- Return up to the number of concepts asked for, through the propose_concepts tool.`;

const PROPOSE_TOOL = {
  name: 'propose_concepts',
  description: 'Concepts for a classroom Lotería deck',
  schema: {
    type: 'object',
    properties: {
      suitable: { type: 'boolean' },
      concepts: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, search: { type: 'array', items: { type: 'string' } } },
          required: ['name', 'search'],
        },
      },
    },
    required: ['suitable', 'concepts'],
  },
};

const REVIEW_SYSTEM = `You check the cards of a classroom Lotería (Mexican picture bingo) before a teacher prints them. Each card has a title in the card language and up to three numbered picture options from a pictogram library. Each option lists the English term that found it and the library's own description of the picture (keywords, meaning, categories).

For every card decide:
- "picture": the number of the option whose picture shows the title's meaning in this topic. Words have several meanings: for the solar system, "La Tierra" is the planet (astronomy, planet), not garden soil (agriculture); "El Anillo" is a planet's ring, not jewelry.
- "keep": false only in one of these cases, otherwise true:
  - no option shows the title's meaning in this topic (a "path" from horse riding for an orbit, ordinary wind for solar wind, a "cold" drink for cold weather);
  - the concept is unrelated to the topic (for "farm animals": an elephant; for "the weather": a car). Closely related concepts stay: for "farm animals", the barn and the farmer; for "the weather", the seasons, umbrellas, coats, and storms;
  - it is unsuitable for school children (weapons, violence, alcohol, scary content);
  - it is not a real word.
  The description only describes the picture; a card is not off-topic just because its categories don't mention the topic.
- "name": the title corrected, the way a native speaker would write it on a Lotería card. Check each noun's grammatical gender and article carefully ("El Tomate", not "La Tomate"; "La Niebla", not "El Niebla"; "La Aurora Boreal"; "Las Botas"), plus spelling and accents. Proper names such as planets usually go without an article ("Mercurio", "Marte"), while "La Tierra" and "El Sol" keep theirs. If the title doesn't match the picture but the picture fits the topic, rename the card to what the picture shows (a "rocket" picture titled "El Misil Balístico" becomes "El Cohete").

Return one entry per card, with its number, through the review_cards tool.`;

const REVIEW_TOOL = {
  name: 'review_cards',
  description: 'Verdict, best picture, and corrected title for each card',
  schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            number: { type: 'integer' },
            keep: { type: 'boolean' },
            picture: { type: 'integer' },
            name: { type: 'string' },
          },
          required: ['number', 'keep', 'picture', 'name'],
        },
      },
    },
    required: ['cards'],
  },
};

// → [{ name, search: [english terms] }]
export async function proposeConcepts({ topic, language, count, avoid = [] }, options) {
  const prompt = [`Topic: ${topic}`, `Language: ${language}`, `How many: ${count}`, avoid.length ? `Avoid: ${avoid.join('; ')}` : '']
    .filter(Boolean)
    .join('\n');
  const answer = await callTool(PROPOSE_SYSTEM, prompt, PROPOSE_TOOL, options);
  if (answer?.suitable === false) throw new DeckError('unsuitable', `"${topic}" is not a topic for a classroom Lotería.`);
  const concepts = Array.isArray(answer?.concepts) ? answer.concepts : [];
  return concepts
    .map(concept => ({
      name: String(concept?.name ?? '').trim(),
      search: [concept?.search].flat().map(word => String(word ?? '').trim()).filter(Boolean),
    }))
    .filter(concept => concept.name && concept.search.length);
}

// candidates: [{ name, options: [{ term, about }] }] → one verdict per candidate, in order:
// { keep, name, picture } with `picture` a 1-based option number (null when Nova skipped the card)
export async function reviewCards({ topic, language, candidates }, options) {
  const lines = candidates.flatMap((candidate, i) => [
    `${i + 1}. ${candidate.name}`,
    ...candidate.options.map((option, j) => `   picture ${j + 1}: ${option.term} — ${option.about}`),
  ]);
  const prompt = [`Topic: ${topic}`, `Card language: ${language}`, 'Cards:', ...lines].join('\n');
  const answer = await callTool(REVIEW_SYSTEM, prompt, REVIEW_TOOL, options, 0); // checking, not inventing: no randomness
  const verdicts = new Map((Array.isArray(answer?.cards) ? answer.cards : []).map(verdict => [Number(verdict?.number), verdict]));
  return candidates.map((candidate, i) => {
    const verdict = verdicts.get(i + 1);
    if (!verdict || typeof verdict.keep !== 'boolean') return null;
    const picture = Number(verdict.picture);
    return {
      keep: verdict.keep,
      name: String(verdict.name ?? '').trim(),
      picture: picture >= 1 && picture <= candidate.options.length ? picture : 1,
    };
  });
}

async function callTool(system, prompt, tool, { fetch = globalThis.fetch, env = process.env } = {}, temperature = 0.3) {
  const region = env.AWS_REGION || 'us-east-1';
  const model = env.NOVA_MODEL_ID || 'us.amazon.nova-2-lite-v1:0';
  const response = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.AWS_BEARER_TOKEN_BEDROCK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 4000, temperature },
      toolConfig: {
        tools: [{ toolSpec: { name: tool.name, description: tool.description, inputSchema: { json: tool.schema } } }],
        toolChoice: { tool: { name: tool.name } },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Amazon Nova answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  return body.output?.message?.content?.find(block => block.toolUse)?.toolUse?.input;
}
