// Daily counters that protect the AWS credit on the public link.
// They live in memory: they start over each day (UTC) and whenever the server restarts.

export class LimitError extends Error {}

// limits: { decks: 100, more: 300 } → count(kind) adds one, or throws LimitError once today's limit is used up.
export function createLimiter(limits, now = () => new Date()) {
  let day = '';
  let used = {};
  return function count(kind) {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = {};
    }
    if ((used[kind] ?? 0) >= limits[kind]) throw new LimitError(`Today's limit of ${limits[kind]} ${kind} was reached.`);
    used[kind] = (used[kind] ?? 0) + 1;
  };
}
