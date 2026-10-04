// Filtering and sorting the results for display and export. Each entry keeps
// its record's place on the page (`i`), which the No. labels, the marks on
// the screenshot and the open links are keyed by.

const text = (v) => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(text).join(' ');
  if (typeof v === 'object') return Object.values(v).map(text).join(' ');
  return String(v);
};

const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** -1/0/1 for two values; empty values always go last (see `view`). */
function compare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(b) - Number(a); // yes first
  return text(a).localeCompare(text(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * `[{ row, i }]` for the rows matching `query` (every word, anywhere in the
 * record, any case), sorted by `sort` (`{ key, dir: 1 | -1 }`) or in page order.
 */
export function view(rows, query = '', sort = null) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let out = rows.map((row, i) => ({ row, i }));
  if (words.length) {
    out = out.filter(({ row }) => {
      const hay = text(row).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  if (sort?.key) {
    const value = (row) => (row && typeof row === 'object' ? row[sort.key] : row);
    out = [...out].sort((x, y) => {
      const a = value(x.row);
      const b = value(y.row);
      if (empty(a) || empty(b)) return empty(a) - empty(b) || x.i - y.i;
      return compare(a, b) * sort.dir || x.i - y.i;
    });
  }
  return out;
}

/** The next sort after clicking `key`: ascending, then descending, then page order. */
export function nextSort(sort, key) {
  if (sort?.key !== key) return { key, dir: 1 };
  return sort.dir === 1 ? { key, dir: -1 } : null;
}
