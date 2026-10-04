import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Copy, Download, ExternalLink, FileJson, Info, Search } from 'lucide-react';
import { fadeUp, popIn } from '../lib/motion';
import { columnsOf, downloadCsv, downloadJson, fillRate, toRows } from '../lib/export';
import { groupNotes } from '../lib/notes';
import { parseFields, typeLabel } from '../lib/schema';
import { NumberTicker, useReveal } from './ui';
import { LogList } from './RunView';

const short = (model) => (model || '').replace(/^openai\//, '');
const isUrl = (v) => typeof v === 'string' && /^https?:\/\//.test(v);
const pretty = (key) => key.replace(/_/g, ' ');

function Cell({ value }) {
  if (value === null || value === undefined || value === '') return <span className="text-faint">—</span>;
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.slice(0, 6).map((v, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[11px]">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </span>
        ))}
        {value.length > 6 && <span className="text-[11px] text-faint">+{value.length - 6}</span>}
      </div>
    );
  }
  if (typeof value === 'boolean')
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs ${value ? 'text-ok' : 'text-bad'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-ok' : 'bg-bad'}`} />
        {value ? 'Yes' : 'No'}
      </span>
    );
  if (typeof value === 'number') return <span className="font-mono tabular-nums">{value.toLocaleString()}</span>;
  if (typeof value === 'object') return <span className="font-mono text-xs text-muted">{JSON.stringify(value)}</span>;
  if (isUrl(value))
    return (
      <a href={value} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent hover:underline break-all line-clamp-1">
        {value.replace(/^https?:\/\/(www\.)?/, '')}
      </a>
    );
  return <span className="line-clamp-2">{String(value)}</span>;
}

function Stat({ label, children, tone = '', bar }) {
  return (
    <div className={`card px-4 py-3 ${tone}`}>
      <div className="eyebrow">{label}</div>
      <div className=" text-2xl font-semibold mt-1 truncate">{children}</div>
      {bar != null && (
        <div className="h-1 mt-2 rounded-full bg-line overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function Notes({ warnings, onRerun, onOpenSettings }) {
  const notes = groupNotes(warnings);
  const [open, setOpen] = useState(false);
  if (!notes.length) return null;
  const warn = notes.some((n) => n.tone === 'warn');
  return (
    <div className={`rounded-md border ${warn ? 'border-warn/30 bg-warn/[0.06]' : 'border-line bg-surface'}`}>
      <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-start gap-x-6 gap-y-2 text-sm">
        <span className={`font-medium inline-flex items-center gap-1.5 shrink-0 ${warn ? 'text-warn' : 'text-muted'}`}>
          {warn ? <AlertTriangle size={15} /> : <Info size={15} />} {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-1.5 min-w-0 flex-1">
          {notes.map((n) => (
            <span key={n.id} className="text-muted">
              <b className="text-fg font-medium">{n.title}</b>
              {n.where && ` on ${n.where}`}. {n.summary}{' '}
              {n.action === 'rerun' && (
                <button onClick={onRerun} className="text-accent hover:underline">
                  Run again
                </button>
              )}
              {n.action === 'settings' && (
                <button onClick={onOpenSettings} className="text-accent hover:underline">
                  Raise the limit
                </button>
              )}
            </span>
          ))}
        </div>
        <button onClick={() => setOpen(!open)} className="text-xs text-muted hover:text-fg inline-flex items-center gap-1 shrink-0" aria-expanded={open}>
          Details <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <ul className="px-4 pb-3 space-y-1 text-xs text-muted list-disc pl-8">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Inspector({ record, index, total, types }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    popIn(ref.current);
  }, [index]);
  if (!record) return null;
  const entries = typeof record === 'object' && !Array.isArray(record) ? Object.entries(record) : [['value', record]];
  const titleEntry = entries.find(([, v]) => typeof v === 'string' && !isUrl(v) && v.length > 2);
  const link = entries.find(([, v]) => isUrl(v));
  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <aside id="record-inspector" ref={ref} className="card p-5 space-y-4 self-start lg:sticky lg:top-20 scroll-mt-20">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Record</span>
        <span className="font-mono text-xs text-muted">
          #{index + 1} of {total}
        </span>
      </div>
      {titleEntry && <div className=" text-xl font-semibold leading-snug break-words">{titleEntry[1]}</div>}
      <dl className="space-y-2.5 text-sm">
        {entries
          .filter((e) => e !== titleEntry)
          .map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3">
              <dt className="text-muted shrink-0 flex items-center gap-1.5">
                {pretty(k)}
                {types[k] && <span className="type-tag bg-subtle border border-line text-faint">{typeLabel(types[k])}</span>}
              </dt>
              <dd className="text-right min-w-0">
                <Cell value={v} />
              </dd>
            </div>
          ))}
      </dl>
      <div>
        <div className="eyebrow mb-1.5">JSON</div>
        <pre className="rounded-md bg-subtle border border-line p-3 font-mono text-[12px] leading-relaxed overflow-auto max-h-64">{JSON.stringify(record, null, 2)}</pre>
      </div>
      <div className="flex gap-2">
        <button onClick={copy} className="btn-outline flex-1 !h-9 text-xs">
          {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy record'}
        </button>
        {link && (
          <a href={link[1]} target="_blank" rel="noreferrer" className="btn-outline flex-1 !h-9 text-xs">
            Open link <ExternalLink size={13} />
          </a>
        )}
      </div>
    </aside>
  );
}

export default function ResultsView({ state, model, onRerun, onOpenSettings }) {
  const { result, request, pages, retries, fallbackModel, logs } = state;
  const rows = useMemo(() => toRows(result?.data), [result]);
  const cols = useMemo(() => columnsOf(rows), [rows]);
  const types = useMemo(() => Object.fromEntries((parseFields(request?.schema)?.fields || []).map((f) => [f.name, f.type])), [request]);
  const [tab, setTab] = useState('table');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const headRef = useReveal(result, { step: 70 });
  const bodyRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const indexed = rows.map((r, i) => [r, i]);
    return q ? indexed.filter(([r]) => JSON.stringify(r).toLowerCase().includes(q)) : indexed;
  }, [rows, query]);

  useEffect(() => setSelected(0), [result]);
  useEffect(() => {
    const items = bodyRef.current?.querySelectorAll('[data-row]');
    if (items?.length) fadeUp(Array.from(items).slice(0, 30), { step: 22, distance: 6 });
  }, [result, tab, query]);

  if (!result) return null;
  let domain = request?.url;
  try {
    domain = new URL(request.url).hostname.replace(/^www\./, '');
  } catch {
    /* keep as is */
  }
  const textRead = pages.reduce((a, p) => a + (p.text || 0), 0);
  const fill = fillRate(result.data);
  const copyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-16 flex flex-col gap-5">
      <div ref={headRef} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs text-ok mb-1 inline-flex items-center gap-1.5">
              <Check size={13} strokeWidth={3} /> Completed in {result.elapsed}s
            </div>
            <div className=" text-4xl sm:text-5xl font-semibold tracking-tight">
              <NumberTicker value={result.items} className="" /> {result.items === 1 ? 'record' : 'records'}
            </div>
            <div className="text-sm text-muted mt-1">
              from {result.pages > 1 ? `${result.pages} pages of ` : ''}
              {domain}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copyAll} className="btn-outline">
              {copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy JSON'}
            </button>
            <button onClick={() => downloadJson(result.data)} className="btn-outline">
              <FileJson size={15} /> Download .json
            </button>
            <button onClick={() => downloadCsv(result.data)} className="btn-primary">
              <Download size={15} /> Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat label="Pages">
            {result.pages}
            <span className="text-sm text-muted font-normal"> / {Math.max(request?.maxPages || 1, result.pages)}</span>
          </Stat>
          <Stat label="Fields filled" bar={fill}>
            {fill == null ? '—' : `${Math.round(fill * 100)}%`}
          </Stat>
          <Stat label="Retries">{pages.length ? retries : '—'}</Stat>
          <Stat label="Text read">
            {textRead ? (
              <>
                {textRead >= 1000 ? `${Math.round(textRead / 1000)}k` : textRead}
                <span className="text-sm text-muted font-normal"> chars</span>
              </>
            ) : (
              '—'
            )}
          </Stat>
          <Stat label="Model" tone={fallbackModel ? '!border-warn/40 col-span-2 lg:col-span-1' : 'col-span-2 lg:col-span-1'}>
            <span className={`text-lg ${fallbackModel ? 'text-warn' : ''}`}>{short(fallbackModel || model)}</span>
            {fallbackModel && <span className="text-xs text-warn font-sans font-normal"> fallback</span>}
          </Stat>
        </div>

        <Notes warnings={result.warnings} onRerun={onRerun} onOpenSettings={onOpenSettings} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="card overflow-hidden min-w-0">
          <div className="px-3 sm:px-4 py-3 border-b border-line flex flex-wrap items-center gap-3">
            <div role="tablist" className="inline-flex p-0.5 rounded-md bg-subtle border border-line">
              {['table', 'json', 'log'].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${tab === t ? 'bg-surface text-fg font-medium shadow-sm' : 'text-muted hover:text-fg'}`}
                >
                  {t === 'json' ? 'JSON' : t}
                </button>
              ))}
            </div>
            {tab === 'table' && (
              <label className="relative flex-1 min-w-[160px] max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <span className="sr-only">Search records</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${rows.length} records`} className="field !h-9 !py-0 !pl-9 text-sm" />
              </label>
            )}
            {tab === 'table' && <span className="ml-auto text-xs text-muted hidden md:inline">Click a row to inspect</span>}
          </div>

          <div ref={bodyRef} className="max-h-[560px] overflow-auto">
            {tab === 'table' && filtered.length === 0 && <div className="py-16 text-center text-sm text-muted">No records match “{query}”.</div>}

            {tab === 'table' && filtered.length > 0 && (
              <>
                <table className="hidden md:table w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur text-[11px] uppercase tracking-wider text-muted">
                    <tr className="border-b border-line">
                      <th className="text-left font-medium px-4 py-2.5 w-12">#</th>
                      {cols.map((c) => (
                        <th key={c} className="text-left font-medium px-4 py-2.5 whitespace-nowrap">
                          {pretty(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {filtered.map(([row, i]) => (
                      <tr
                        key={i}
                        data-row
                        onClick={() => setSelected(i)}
                        className={`cursor-pointer align-top transition-colors ${selected === i ? 'bg-accent/10' : 'hover:bg-subtle/70'}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-faint">{String(i + 1).padStart(2, '0')}</td>
                        {cols.map((c) => (
                          <td key={c} className="px-4 py-3 max-w-[360px]">
                            <Cell value={row?.[c]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="md:hidden divide-y divide-line">
                  {filtered.map(([row, i]) => (
                    <button
                      key={i}
                      data-row
                      onClick={() => {
                        setSelected(i);
                        document.getElementById('record-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`w-full text-left px-4 py-3 space-y-1.5 ${selected === i ? 'bg-accent/10' : ''}`}>
                      <div className="font-mono text-[11px] text-faint">#{i + 1}</div>
                      {cols.slice(0, 4).map((c) => (
                        <div key={c} className="flex justify-between gap-3 text-sm">
                          <span className="text-muted shrink-0">{pretty(c)}</span>
                          <span className="text-right min-w-0">
                            <Cell value={row?.[c]} />
                          </span>
                        </div>
                      ))}
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === 'json' && <pre className="p-4 font-mono text-[12px] leading-relaxed select-text">{JSON.stringify(result.data, null, 2)}</pre>}

            {tab === 'log' && (
              <div className="p-4">
                <LogList logs={logs} />
              </div>
            )}
          </div>
        </div>

        <Inspector record={rows[selected]} index={selected} total={rows.length} types={types} />
      </div>
    </section>
  );
}
