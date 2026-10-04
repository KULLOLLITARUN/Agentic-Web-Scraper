// Converts between the plain-English field description the backend reads
// ("Each book: title (string), price (float)") and editable field chips.
// Type words match _TYPE_KEYWORDS in scraper/validator.py, checked in the
// same order ("list of ints" is a list).

export const TYPES = [
  { id: 'string', label: 'text', word: 'string' },
  { id: 'float', label: 'number', word: 'float' },
  { id: 'int', label: 'whole number', word: 'int' },
  { id: 'bool', label: 'yes/no', word: 'boolean' },
  { id: 'list', label: 'list', word: 'list of strings' },
  { id: 'any', label: 'any', word: '' },
];

const TYPE_PATTERNS = [
  ['list', /\b(list|array)\b/],
  ['bool', /\bbool(ean)?\b/],
  ['float', /\b(float|number|decimal|double)\b/],
  ['int', /\b(int|integer)\b/],
  ['string', /\b(str|string|text|url)\b/],
];

export const typeOf = (spec) => {
  const s = (spec || '').toLowerCase();
  return (TYPE_PATTERNS.find(([, re]) => re.test(s)) || ['any'])[0];
};

export const typeLabel = (id) => (TYPES.find((t) => t.id === id) || TYPES[TYPES.length - 1]).label;

// Split on commas that aren't inside parentheses.
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Parse a description into `{ prefix, fields }`, or `null` when it isn't a
 * plain list of fields (free-form prose stays editable as text only).
 * Each field is `{ name, spec, type }`; `spec` is the text in parentheses.
 */
export function parseFields(text) {
  const source = (text || '').trim();
  if (!source) return { prefix: 'Each item', fields: [] };
  const colon = source.indexOf(':');
  const prefix = colon > -1 && colon < 40 ? source.slice(0, colon).trim() : 'Each item';
  const body = colon > -1 && colon < 40 ? source.slice(colon + 1) : source;
  const fields = [];
  for (const part of splitTopLevel(body)) {
    const match = part.match(/^([A-Za-z_]\w*)\s*(?:\(([^()]*)\))?\.?$/);
    if (!match) return null;
    const spec = (match[2] || '').trim();
    fields.push({ name: match[1], spec, type: typeOf(spec) });
  }
  return { prefix, fields };
}

export function buildSchema(prefix, fields) {
  const list = fields.map((f) => (f.spec ? `${f.name} (${f.spec})` : f.name)).join(', ');
  return `${prefix || 'Each item'}: ${list}`;
}

/** A field with its type changed; extra notes after the type are kept. */
export function withType(field, typeId) {
  const word = (TYPES.find((t) => t.id === typeId) || {}).word || '';
  const note = field.spec.includes(',') ? field.spec.slice(field.spec.indexOf(',')) : '';
  return { ...field, type: typeId, spec: word ? `${word}${note}` : note.replace(/^,\s*/, '') };
}

export const toFieldName = (raw) =>
  raw.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, '_$1');
