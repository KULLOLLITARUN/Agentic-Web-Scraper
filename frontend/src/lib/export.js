import { buildXlsx } from './xlsx';

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export function toRows(data) {
  if (data == null) return [];
  return Array.isArray(data) ? data : [data];
}

export function columnsOf(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (row && typeof row === 'object' && !Array.isArray(row)) Object.keys(row).forEach((k) => seen.add(k));
  }
  return [...seen];
}

export function downloadCsv(data) {
  const rows = toRows(data);
  if (!rows.length) return;
  const cols = columnsOf(rows);
  const cell = (v) => {
    const text = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [cols.map(cell).join(','), ...rows.map((r) => cols.map((c) => cell(r?.[c])).join(','))].join('\n');
  download(`scrape-${stamp()}.csv`, csv, 'text/csv;charset=utf-8');
}

export function downloadXlsx(data) {
  const rows = toRows(data);
  if (!rows.length) return;
  // A list of plain values (not objects) becomes one "value" column.
  const objects = rows.every((r) => r && typeof r === 'object' && !Array.isArray(r));
  const sheetRows = objects ? rows : rows.map((value) => ({ value }));
  download(`scrape-${stamp()}.xlsx`, buildXlsx(sheetRows, columnsOf(sheetRows)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function downloadJson(data) {
  download(`scrape-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
}

/** Share of fields (across all records) that have a value. */
export function fillRate(data) {
  const rows = toRows(data);
  const cols = columnsOf(rows);
  if (!rows.length || !cols.length) return null;
  let filled = 0;
  for (const row of rows) for (const c of cols) {
    const v = row?.[c];
    if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) filled += 1;
  }
  return filled / (rows.length * cols.length);
}
