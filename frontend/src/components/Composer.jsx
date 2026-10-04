import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { motion } from '../lib/motion';
import { TYPES, typeOf } from '../lib/schema';

export const PRESETS = [
  {
    name: 'Books',
    url: 'https://books.toscrape.com',
    what: 'every book with its title, price, star rating and stock',
    schema: 'Each book: title (string), price (float, no currency symbol), rating (string), in_stock (boolean)',
  },
  {
    name: 'Quotes',
    url: 'https://quotes.toscrape.com',
    what: 'each quote with its text, author and tags',
    schema: 'Each quote: text (string), author (string), tags (list of strings)',
  },
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    what: 'every story with its rank, title, link, points and comment count',
    schema: 'Each story: rank (int), title (string), url (string), points (int or null), comments_count (int or null)',
  },
  {
    name: 'Naukri jobs',
    url: 'https://www.naukri.com/ai-ml-engineer-jobs-in-bangalore?k=ai%20ml%20engineer&l=bangalore&nignbevent_src=jobsearchDeskGNB',
    what: 'every job with title, company, experience, salary, location and skills',
    schema: 'Each job: title (string), company (string), experience (string), salary (string), location (string), skills (list of strings)',
  },
];

/** "price (float, no currency symbol)" pieces -> { name, type, note }. */
export function toField({ name, spec }) {
  const type = typeOf(spec);
  const word = { string: /\b(str|string|text|url)\b/i, float: /\b(float|number|decimal|double)\b/i, int: /\b(int|integer)\b/i, bool: /\bbool(ean)?\b/i, list: /\b(list of \w+|list|array)\b/i }[type];
  const note = word ? spec.replace(word, '').replace(/^[\s,]+|[\s,]+$/g, '') : spec;
  return { name, type, note };
}

/** The description the backend reads: the words, plus typed fields when on. */
export function buildRequest(what, fields, useFields) {
  const words = what.trim();
  const named = fields.filter((f) => f.name.trim());
  if (!useFields || !named.length) return words;
  const list = named.map((f) => {
    const typeWord = (TYPES.find((t) => t.id === f.type) || {}).word || '';
    const spec = [typeWord, f.note.trim()].filter(Boolean).join(', ');
    return spec ? `${f.name.trim()} (${spec})` : f.name.trim();
  });
  return `${words || 'Each item'}: ${list.join(', ')}`;
}

function Toggle({ checked, onChange, label }) {
  const knob = useRef(null);
  useEffect(() => {
    motion(knob.current, { translateX: checked ? 16 : 0, duration: 360, ease: 'outBack(1.8)' });
  }, [checked]);
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-fg' : 'bg-line2'}`}>
      <span ref={knob} className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-surface shadow" />
    </button>
  );
}

export default function Composer({ url, setUrl, what, setWhat, fields, setFields, useFields, setUseFields, options, setOption, running, onRun, onStop }) {
  const [advanced, setAdvanced] = useState(false);
  const canRun = url.trim() && (what.trim() || (useFields && fields.some((f) => f.name.trim())));
  const blank = 'min-w-0 border-0 border-b-2 border-fg bg-transparent outline-none px-0.5 pb-0.5 rounded-none focus:border-pencil disabled:border-dashed disabled:text-muted';

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canRun && !running) {
      e.preventDefault();
      onRun();
    }
  };
  const updateField = (i, patch) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <section className="px-4 md:px-7 pt-4 md:pt-6 pb-3.5 md:pb-5 border-b border-line" onKeyDown={onKeyDown}>
      <div className="font-serif text-[26px] md:text-[34px] leading-tight flex flex-wrap items-baseline gap-x-2 md:gap-x-3 gap-y-1">
        <label className="contents">
          <span>From</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
            aria-label="Page URL"
            inputMode="url"
            spellCheck={false}
            placeholder="example.com/products"
            className={`${blank} font-mono text-[17px] md:text-[21px] basis-full md:basis-auto md:w-[340px] placeholder:text-faint`}
          />
        </label>
        <label className="contents">
          <span>get</span>
          <input
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            disabled={running}
            aria-label="What to extract"
            placeholder="every product with its name and price"
            className={`${blank} font-sans text-[17px] md:text-[21px] basis-full md:basis-[360px] md:grow placeholder:text-faint`}
          />
        </label>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2 md:gap-2.5">
        <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line2 bg-surface text-[13px] text-muted whitespace-nowrap">
          as a
          <select value={options.expectList ? 'list' : 'one'} onChange={(e) => setOption('expectList', e.target.value === 'list')} disabled={running}
            className="bg-transparent font-semibold text-fg outline-none">
            <option value="list">list</option>
            <option value="one">single record</option>
          </select>
        </label>
        <label className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line2 bg-surface text-[13px] text-muted whitespace-nowrap ${options.expectList ? '' : 'opacity-50'}`}>
          pages
          <select value={options.maxPages} onChange={(e) => setOption('maxPages', Number(e.target.value))} disabled={running || !options.expectList}
            className="bg-transparent font-semibold text-fg outline-none">
            {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n === 1 ? 'just this one' : `up to ${n}`}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setUseFields(!useFields)} aria-expanded={useFields}
          className="text-[13px] underline underline-offset-[3px] decoration-faint hover:decoration-fg whitespace-nowrap">
          {useFields ? 'use words only' : 'define exact fields'}
        </button>
        <button type="button" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}
          className="text-[13px] underline underline-offset-[3px] decoration-faint hover:decoration-fg">
          advanced
        </button>
        {running ? (
          <button onClick={onStop} className="order-last md:order-none w-full md:w-auto md:ml-auto h-12 md:h-11 px-6 rounded-lg border-[1.5px] border-pencil text-pencil font-semibold">
            Stop
          </button>
        ) : (
          <button onClick={onRun} disabled={!canRun}
            className="order-last md:order-none w-full md:w-auto md:ml-auto h-12 md:h-11 px-6 rounded-lg bg-fg text-bg font-semibold inline-flex items-center justify-center gap-2.5 shadow-[0_2px_0_rgba(0,0,0,.28)] active:translate-y-px active:shadow-none disabled:opacity-40">
            Run scrape <kbd className="hidden md:inline font-mono text-[11px] opacity-60">Ctrl ↵</kbd>
          </button>
        )}
      </div>

      {useFields && (
        <div className="mt-3.5 overflow-x-auto">
          <table className="min-w-[600px] text-sm bg-surface border border-line rounded-md border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="font-medium px-2 py-1.5 border-b border-line">field</th>
                <th className="font-medium px-2 py-1.5 border-b border-line">type</th>
                <th className="font-medium px-2 py-1.5 border-b border-line">note for the model</th>
                <th className="border-b border-line" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5 border-b border-line w-44">
                    <input value={f.name} onChange={(e) => updateField(i, { name: e.target.value.replace(/\s+/g, '_') })} aria-label="Field name"
                      className="w-full border border-line rounded bg-bg px-2 py-1 font-mono text-[13px] outline-none focus:border-fg" />
                  </td>
                  <td className="px-2 py-1.5 border-b border-line w-40">
                    <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value })} aria-label="Field type"
                      className="w-full border border-line rounded bg-bg px-2 py-1 text-[13px] outline-none focus:border-fg">
                      {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 border-b border-line">
                    <input value={f.note} onChange={(e) => updateField(i, { note: e.target.value })} placeholder="optional" aria-label="Note for the model"
                      className="w-full border border-line rounded bg-bg px-2 py-1 text-[13px] outline-none focus:border-fg placeholder:text-faint" />
                  </td>
                  <td className="px-1 border-b border-line">
                    <button onClick={() => setFields(fields.filter((_, j) => j !== i))} className="w-7 h-7 grid place-items-center rounded text-faint hover:text-fg" aria-label={`Remove ${f.name}`}>
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button onClick={() => setFields([...fields, { name: '', type: 'string', note: '' }])} className="inline-flex items-center gap-1 text-[13px] font-medium">
              <Plus size={14} /> Add field
            </button>
            <span className="text-xs text-faint">Each record is checked against these types; mismatches are asked again.</span>
          </div>
        </div>
      )}

      {advanced && (
        <div className="mt-3.5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl">
          <div className="flex items-center justify-between gap-3 bg-surface border border-line rounded-md px-3 py-2">
            <span className="text-[13px]">Retry attempts</span>
            <select value={options.retries} onChange={(e) => setOption('retries', Number(e.target.value))} className="bg-transparent font-mono text-[13px] outline-none">
              {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 bg-surface border border-line rounded-md px-3 py-2">
            <span className="text-[13px]">Auto-scroll</span>
            <Toggle label="Auto-scroll" checked={options.scroll} onChange={(v) => setOption('scroll', v)} />
          </div>
          <div className={`flex items-center justify-between gap-3 bg-surface border border-line rounded-md px-3 py-2 ${options.scroll ? '' : 'opacity-50'}`}>
            <span className="text-[13px]">Scrolls</span>
            <input type="range" min={1} max={20} value={options.maxScrolls} disabled={!options.scroll} onChange={(e) => setOption('maxScrolls', Number(e.target.value))}
              aria-label="Scrolls" className="w-24 accent-[rgb(var(--fg))]" />
            <span className="font-mono text-xs w-5 text-right">{options.maxScrolls}</span>
          </div>
          <div className="flex items-center justify-between gap-3 bg-surface border border-line rounded-md px-3 py-2">
            <span className="text-[13px]">Show browser window</span>
            <Toggle label="Show browser window" checked={!options.headless} onChange={(v) => setOption('headless', !v)} />
          </div>
        </div>
      )}
    </section>
  );
}
