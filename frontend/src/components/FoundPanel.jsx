import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileJson } from 'lucide-react';
import { fadeUp, motion } from '../lib/motion';
import { columnsOf, downloadCsv, downloadJson, fillRate, toRows } from '../lib/export';
import { groupNotes } from '../lib/notes';
import { STEPS } from '../lib/useScrape';
import { NumberTicker } from './ui';
import { PRESETS } from './Composer';

const isUrl = (v) => typeof v === 'string' && /^https?:\/\//.test(v);
const pad = (i) => String(i + 1).padStart(2, '0');
const label = (key) => key.replace(/_/g, ' ');
const STEP_NAME = { fetch: 'Load the page', distill: 'Clean the text', infer: 'Extract records', validate: 'Check fields' };

function Value({ v, mono }) {
  if (v === null || v === undefined || v === '') return <span className="text-faint">—</span>;
  if (typeof v === 'boolean') return <span className={v ? 'text-ok' : 'text-pencil'}>{v ? 'yes' : 'no'}</span>;
  if (typeof v === 'number') return <span className="font-mono tabular-nums">{v.toLocaleString()}</span>;
  if (Array.isArray(v)) return <span className="text-muted">{v.slice(0, 3).map(String).join(', ')}{v.length > 3 ? ` +${v.length - 3}` : ''}</span>;
  if (typeof v === 'object') return <span className="font-mono text-xs text-muted">{JSON.stringify(v)}</span>;
  if (isUrl(v))
    return (
      <a href={v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline decoration-faint underline-offset-2 hover:decoration-fg break-all">
        {v.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}
      </a>
    );
  return <span className={mono ? 'font-mono' : ''}>{String(v)}</span>;
}

/** The field to use as a card's title: the first longish text that isn't a link. */
function titleKey(cols, rows) {
  const sample = rows.slice(0, 10);
  return cols.find((c) => sample.some((r) => typeof r?.[c] === 'string' && !isUrl(r[c]) && r[c].length > 3)) || cols[0];
}

function Card({ row, i, cols, tkey }) {
  const others = cols.filter((c) => c !== tkey).slice(0, 4);
  return (
    <article data-row className="bg-surface border border-line rounded px-3 pt-2 pb-2.5 text-left hover:border-fg transition-colors">
      <div className="font-mono text-[11px] text-faint pb-1.5 mb-1.5 border-b border-pencil/30">No. {pad(i)}</div>
      <div className="font-semibold text-sm leading-snug line-clamp-2 mb-1.5"><Value v={row?.[tkey]} /></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {others.map((c) => (
          <React.Fragment key={c}>
            <dt className="text-faint">{label(c)}</dt>
            <dd className="m-0 text-right truncate"><Value v={row?.[c]} /></dd>
          </React.Fragment>
        ))}
      </dl>
    </article>
  );
}

function Count({ value, word, underline }) {
  const path = useRef(null);
  useEffect(() => {
    if (!underline || !path.current) return;
    const len = path.current.getTotalLength();
    path.current.style.strokeDasharray = len;
    motion(path.current, { strokeDashoffset: [len, 0], duration: 700, ease: 'outQuad' });
  }, [underline, value]);
  return (
    <div className="flex items-end gap-3">
      <span className="relative inline-block font-serif text-[64px] md:text-[78px] leading-[.88]">
        <NumberTicker value={value} />
        {underline && (
          <svg viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true" className="absolute -left-1 -bottom-[11px] w-[calc(100%+8px)] h-3.5 overflow-visible">
            <path ref={path} d="M2 9 C 30 3, 60 13, 118 5" stroke="rgb(var(--hl))" strokeWidth="7" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="font-serif italic text-2xl md:text-[28px] text-muted pb-1">{word}</span>
    </div>
  );
}

function Progress({ state }) {
  const { step, current, pages, retries, request } = state;
  const index = STEPS.indexOf(step);
  const page = pages.find((p) => p.n === current.page) || {};
  const detail = {
    fetch: page.html ? `${(page.html / 1024).toFixed(1)} KB of HTML` : 'opening in Chromium',
    distill: page.text ? `${page.text.toLocaleString()} characters left` : '',
    infer: [current.parts && `part ${current.part} of ${current.parts}`, current.attempt > 1 && `attempt ${current.attempt}`].filter(Boolean).join(' · '),
    validate: retries ? `${retries} asked again` : '',
  };
  return (
    <div className="mt-6 space-y-5">
      <ol className="space-y-0">
        {STEPS.map((s, i) => {
          const st = i < index ? 'done' : i === index ? 'live' : 'todo';
          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`w-6 h-6 rounded-full grid place-items-center font-mono text-[11px] ${st === 'done' ? 'bg-fg text-bg' : st === 'live' ? 'border-2 border-pencil text-pencil' : 'border border-line2 text-faint'}`}>
                  {st === 'done' ? '✓' : i + 1}
                </span>
                {i < STEPS.length - 1 && <span className={`w-px flex-1 my-1 ${st === 'done' ? 'bg-fg' : 'bg-line2'}`} />}
              </div>
              <div className="pb-4 min-w-0">
                <div className={`font-medium ${st === 'todo' ? 'text-faint' : ''}`}>{STEP_NAME[s]}</div>
                {st !== 'todo' && detail[s] && <div className="text-xs text-muted">{detail[s]}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      {(request?.maxPages || 1) > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {pages.map((p) => (
            <div key={p.n} className={`rounded border px-2.5 py-2 ${p.status === 'running' ? 'border-pencil' : 'border-line'}`}>
              <div className="flex justify-between"><span className="font-mono">page {p.n}</span><span className={p.status === 'running' ? 'text-pencil' : 'text-ok'}>{p.status === 'running' ? 'reading' : `${p.records} ✓`}</span></div>
            </div>
          ))}
          {Array.from({ length: Math.max(0, request.maxPages - pages.length) }).map((_, i) => (
            <div key={i} className="rounded border border-dashed border-line2 px-2.5 py-2 text-faint font-mono">page {pages.length + i + 1}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function suggestions(step, message) {
  const m = message.toLowerCase();
  const tips = [];
  if (m.includes('/scrape/stream') || m.includes('failed to fetch') || m.includes('networkerror')) tips.push('Is the backend running? Start it with start.bat, or check the backend URL in Settings.');
  if (m.includes('api key') || m.includes('401') || m.includes('authentication')) tips.push('Check the API key in .env, or paste one in Settings.');
  if (m.includes('rate limit') || m.includes('usage limit') || m.includes('429') || m.includes('tokens per')) tips.push('The usage limit was reached. Wait a minute (the daily limit resets over the day).');
  if (step === 'fetch') {
    tips.push('Open the link in your browser to check it exists.');
    tips.push('Sites that block bots: turn on “show browser window” in advanced.');
  }
  if (step === 'validate' || m.includes('no items')) tips.push('Describe what you want more plainly, or define the fields with types.');
  if (!tips.length) tips.push('Temporary errors often go away on a second run.');
  return tips.slice(0, 3);
}

function Results({ state, onRerun, onOpenSettings }) {
  const { result, retries, fallbackModel, request } = state;
  const rows = useMemo(() => toRows(result.data), [result]);
  const cols = useMemo(() => columnsOf(rows), [rows]);
  const tkey = useMemo(() => titleKey(cols, rows), [cols, rows]);
  const [view, setView] = useState(rows.length > 20 ? 'table' : 'cards');
  const [copied, setCopied] = useState(false);
  const listRef = useRef(null);
  const notes = groupNotes(result.warnings);
  const fill = fillRate(result.data);

  useEffect(() => setView(rows.length > 20 ? 'table' : 'cards'), [result]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const items = listRef.current?.querySelectorAll('[data-row]');
    if (items?.length) fadeUp(Array.from(items).slice(0, 24), { step: 30, distance: 8 });
  }, [result, view]);

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const actions = (
    <>
      <button onClick={() => downloadCsv(result.data)} className="btn-primary"><Download size={15} /> Export CSV</button>
      <button onClick={() => downloadJson(result.data)} className="btn-outline"><FileJson size={15} /> JSON</button>
      <button onClick={copy} className="btn-outline">{copied ? <Check size={15} className="text-ok" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}</button>
    </>
  );

  return (
    <>
      <Count value={result.items} word={result.items === 1 ? 'record' : 'records'} underline />
      <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 mt-4 mb-3.5 text-[13px] text-muted">
        <span><b className="font-mono font-medium text-fg">{result.pages}</b> {result.pages === 1 ? 'page' : 'pages'}</span>
        <span><b className="font-mono font-medium text-fg">{result.elapsed}s</b></span>
        {fill != null && <span><b className="font-mono font-medium text-fg">{Math.round(fill * 100)}%</b> fields filled</span>}
        {retries > 0 && <span><b className="font-mono font-medium text-fg">{retries}</b> asked again</span>}
        {fallbackModel && <span className="text-warn">backup model used</span>}
      </div>

      {notes.map((n) => (
        <div key={n.id} className="border-l-[3px] border-pencil bg-pencil/[.07] px-3 py-2 text-[13px] mb-2 rounded-r">
          <span className="font-serif italic text-[17px] text-pencil mr-1">note:</span>
          <b className="font-semibold">{n.title}</b>{n.where && ` on ${n.where}`}. {n.summary}{' '}
          {n.action === 'rerun' && <button onClick={onRerun} className="underline underline-offset-2">Run again later</button>}
          {n.action === 'settings' && <button onClick={onOpenSettings} className="underline underline-offset-2">Raise the limit</button>}
        </div>
      ))}

      <div className="flex flex-wrap justify-between items-center gap-2 mt-3.5 mb-2.5">
        <div role="tablist" className="inline-flex border border-line2 rounded-md overflow-hidden">
          {['cards', 'table', 'json'].map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`px-3 py-1 text-xs capitalize ${v !== 'cards' ? 'border-l border-line2' : ''} ${view === v ? 'bg-fg text-bg' : 'bg-surface text-muted hover:text-fg'}`}>
              {v === 'json' ? 'JSON' : v}
            </button>
          ))}
        </div>
        <span className="text-xs text-faint">{request?.schema && /\(\w/.test(request.schema) ? 'checked against your fields' : 'columns chosen from your description'}</span>
      </div>

      <div ref={listRef} className="md:max-h-[calc(100vh-470px)] md:min-h-[280px] md:overflow-auto">
        {view === 'cards' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-px">
            {rows.map((row, i) => <Card key={i} row={row} i={i} cols={cols} tkey={tkey} />)}
          </div>
        )}
        {view === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] bg-surface border border-line border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-surface text-left font-medium text-xs text-faint px-2.5 py-2 border-b border-fg">No.</th>
                  {cols.map((c) => <th key={c} className="sticky top-0 bg-surface text-left font-medium text-xs text-faint px-2.5 py-2 border-b border-fg whitespace-nowrap">{label(c)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} data-row className="hover:bg-pencil/[.05]">
                    <td className="px-2.5 py-2 border-b border-line font-mono text-faint align-top">{pad(i)}</td>
                    {cols.map((c) => <td key={c} className="px-2.5 py-2 border-b border-line align-top max-w-[320px]"><Value v={row?.[c]} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {view === 'json' && <pre className="m-0 bg-surface border border-line p-3 font-mono text-xs leading-relaxed overflow-auto">{JSON.stringify(result.data, null, 2)}</pre>}
      </div>

      <div className="hidden md:flex gap-2 mt-3.5">{actions}</div>
      <div className="md:hidden fixed inset-x-0 bottom-0 z-20 flex gap-2 px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] bg-bg border-t border-line [&>button]:flex-1 [&>button]:h-11 [&>button]:px-2 [&>button]:whitespace-nowrap [&_svg]:hidden sm:[&_svg]:block">
        {actions}
      </div>
    </>
  );
}

export default function FoundPanel({ state, onRerun, onOpenSettings, onPickExample, onRetry, onEdit }) {
  const { status, total, error } = state;

  if (status === 'idle' && !state.result) {
    return (
      <div className="border-[1.5px] border-dashed border-line2 rounded-md p-5 md:p-7 text-center">
        <div className="font-serif text-[28px] md:text-[34px] leading-tight mb-4">Or start from one of these</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => onPickExample(p)} className="text-left bg-surface border border-line rounded px-3 py-2.5 hover:border-fg transition-colors">
              <span className="block font-semibold text-sm leading-snug">{p.what}</span>
              <span className="font-mono text-[11px] text-faint">{new URL(p.url).hostname.replace(/^www\./, '')}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (status === 'error' && error) {
    return (
      <div className="border border-pencil rounded-md bg-surface px-5 py-5">
        <div className="font-mono text-xs text-pencil">stopped at “{STEP_NAME[error.step]?.toLowerCase()}” · {error.elapsed.toFixed(1)}s</div>
        <div className="font-serif text-[30px] leading-tight my-1.5">That didn't work.</div>
        <p className="text-muted text-sm break-words m-0">{error.message}</p>
        <ol className="list-decimal pl-5 text-sm text-muted mt-3 space-y-1">{suggestions(error.step, error.message).map((t) => <li key={t}>{t}</li>)}</ol>
        <div className="flex gap-2 mt-4">
          <button onClick={onEdit} className="btn-outline">Edit</button>
          <button onClick={onRetry} className="btn-primary">Try again</button>
        </div>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <>
        <Count value={total} word="so far" />
        <Progress state={state} />
      </>
    );
  }

  return state.result ? <Results state={state} onRerun={onRerun} onOpenSettings={onOpenSettings} /> : null;
}
