// Groups the backend's warning sentences into short notes: one per kind of
// problem, saying where it happened ("pages 2–3"), with the full messages kept
// for a details view. Matches the wording in scraper/pipeline.py.

const KINDS = [
  { id: 'fallback', test: /was unavailable/, title: 'Fallback model used', tone: 'warn',
    hint: 'It can miss items.', action: 'rerun' },
  { id: 'length', test: /hit its length limit/, title: 'Output cut short', tone: 'warn',
    hint: 'The model ran out of room; items after the cut are missing.' },
  { id: 'mismatch', test: /didn't match your fields/, title: 'Some values don\'t match your fields', tone: 'warn',
    hint: 'Check the field types, or open the table to see which values.' },
  { id: 'cutoff', test: /cut off at|Only the first/, title: 'Page text cut off', tone: 'info',
    hint: 'Items further down may be missing.', action: 'settings' },
  { id: 'stopped', test: /Stopped after page/, title: 'Stopped early', tone: 'warn',
    hint: 'A later page failed; the records from earlier pages are kept.' },
];

function locate(message) {
  const page = message.match(/^Page (\d+): /);
  const part = message.match(/Part (\d+) of (\d+): /);
  return { page: page ? Number(page[1]) : null, part: part ? Number(part[1]) : null };
}

function range(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (!sorted.length) return '';
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const contiguous = last - first + 1 === sorted.length;
  return sorted.length === 1 ? String(first) : contiguous ? `${first}–${last}` : sorted.join(', ');
}

export function groupNotes(warnings = []) {
  const groups = new Map();
  for (const message of warnings) {
    const kind = KINDS.find((k) => k.test.test(message)) || { id: 'other', title: 'Note', tone: 'info', hint: '' };
    const group = groups.get(kind.id) || { ...kind, messages: [], pages: [], parts: [] };
    const where = locate(message);
    if (where.page) group.pages.push(where.page);
    if (where.part) group.parts.push(where.part);
    group.messages.push(message.replace(/^Page \d+: /, '').replace(/^Part \d+ of \d+: /, ''));
    groups.set(kind.id, group);
  }
  return [...groups.values()].map((g) => {
    const label = (word, numbers) => {
      const many = new Set(numbers).size > 1;
      return numbers.length ? `${word}${many ? 's' : ''} ${range(numbers)}` : '';
    };
    const where = label('page', g.pages) || label('part', g.parts);
    const summary = g.id === 'other' ? g.messages[0] : g.hint;
    return { ...g, where, summary };
  });
}
