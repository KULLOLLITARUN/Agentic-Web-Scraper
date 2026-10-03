import React, { useEffect, useRef } from 'react';
import { Play, Square, Loader2, Link2, ListChecks, SlidersHorizontal, ScrollText, Trash2 } from 'lucide-react';
import { fadeUp, motion } from '../lib/motion';

const PRESETS = [
  {
    name: 'Quotes',
    url: 'https://quotes.toscrape.com',
    schema: 'Each quote: text (string), author (string), tags (list of strings)',
  },
  {
    name: 'Books',
    url: 'https://books.toscrape.com',
    schema: 'Each book: title (string), price (float, no currency symbol), rating (string), in_stock (boolean)',
  },
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com',
    schema: 'Each story: rank (int), title (string), url (string), points (int or null), comments_count (int or null)',
  },
  {
    name: 'Naukri Jobs',
    url: 'https://www.naukri.com/ai-ml-engineer-jobs-in-bangalore?k=ai%20ml%20engineer&l=bangalore&nignbevent_src=jobsearchDeskGNB',
    schema: 'Each job: title (string), company (string), experience (string), salary (string), location (string), skills (list of strings)',
  },
];

function Toggle({ checked, onChange, label }) {
  const knob = useRef(null);
  useEffect(() => {
    motion(knob.current, { translateX: checked ? 16 : 0, duration: 380, ease: 'outBack(1.8)' });
  }, [checked]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span ref={knob} className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
    </button>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-subtle p-0.5 border border-line">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 h-7 rounded-md text-xs font-medium transition-all ${
            value === o.value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const LOG_TONE = {
  error: 'text-bad',
  warn: 'text-warn',
  retry: 'text-warn',
  info: 'text-ok',
};

export default function ConfigPanel({
  url,
  setUrl,
  schema,
  setSchema,
  retries,
  setRetries,
  expectList,
  setExpectList,
  scroll = true,
  setScroll,
  maxScrolls = 5,
  setMaxScrolls,
  headless = true,
  setHeadless,
  onRun,
  onCancel,
  isLoading,
  logs = [],
  onClearLogs,
}) {
  const rootRef = useRef(null);
  const runRef = useRef(null);
  const logListRef = useRef(null);
  const canRun = !isLoading && url && schema;

  useEffect(() => {
    fadeUp(rootRef.current?.querySelectorAll('[data-enter]'), { step: 70 });
  }, []);

  // Animate the newest log line in.
  useEffect(() => {
    const first = logListRef.current?.firstElementChild;
    if (first) motion(first, { opacity: [0, 1], translateX: [-8, 0], duration: 350, ease: 'outQuad' });
  }, [logs.length]);

  const run = () => {
    if (!canRun) return;
    motion(runRef.current, { scale: [0.96, 1], duration: 450, ease: 'outElastic(1, .5)' });
    onRun();
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  };

  const loadPreset = (p, el) => {
    setUrl(p.url);
    setSchema(p.schema);
    motion(el, { scale: [0.92, 1], duration: 400, ease: 'outBack(2)' });
  };

  return (
    <div ref={rootRef} className="h-full overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 [&>*]:shrink-0">
      {/* Presets */}
      <div data-enter className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted mr-1">Try an example:</span>
        {PRESETS.map((p) => {
          const active = p.url === url;
          return (
            <button
              key={p.name}
              onClick={(e) => loadPreset(p, e.currentTarget)}
              className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'bg-surface border-line text-muted hover:text-fg hover:border-faint'
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Target */}
      <section data-enter className="card p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="url" className="label flex items-center gap-1.5">
            <Link2 size={14} /> Page URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/products"
            className="field font-mono text-[13px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="schema" className="label flex items-center gap-1.5">
              <ListChecks size={14} /> Fields to extract
            </label>
            <span className="text-[11px] text-faint">{schema.length} chars</span>
          </div>
          <textarea
            id="schema"
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="Each item: name (string), price (float), tags (list of strings)"
            className="field resize-y leading-relaxed min-h-[96px]"
          />
          <p className="text-[11px] text-faint">Describe each record's fields and types in plain English.</p>
        </div>
      </section>

      {/* Options */}
      <section data-enter className="card divide-y divide-line">
        <div className="px-4 py-3 flex items-center gap-1.5 label">
          <SlidersHorizontal size={14} /> Options
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm">Retry attempts</div>
            <div className="text-[11px] text-faint">Self-heal if validation fails</div>
          </div>
          <Segmented
            value={retries}
            onChange={setRetries}
            options={[1, 2, 3, 5].map((n) => ({ value: n, label: String(n) }))}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm">Result shape</div>
            <div className="text-[11px] text-faint">Many records or one object</div>
          </div>
          <Segmented
            value={expectList}
            onChange={setExpectList}
            options={[
              { value: true, label: 'List' },
              { value: false, label: 'Single' },
            ]}
          />
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm">Auto-scroll</div>
              <div className="text-[11px] text-faint">Load lazy / infinite content</div>
            </div>
            <Toggle checked={scroll} onChange={(v) => setScroll?.(v)} label="Auto-scroll" />
          </div>
          <div className={`flex items-center gap-3 transition-opacity ${scroll ? '' : 'opacity-40 pointer-events-none'}`}>
            <input
              type="range"
              min="1"
              max="15"
              value={maxScrolls}
              disabled={!scroll}
              onChange={(e) => setMaxScrolls(parseInt(e.target.value, 10))}
              className="flex-1 cursor-pointer"
              aria-label="Max scrolls"
            />
            <span className="w-14 text-right text-xs font-medium tabular-nums">{maxScrolls} scrolls</span>
          </div>
        </div>

        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm">Show browser window</div>
            <div className="text-[11px] text-faint">Off runs Chromium headless</div>
          </div>
          <Toggle checked={!headless} onChange={(v) => setHeadless?.(!v)} label="Show browser window" />
        </div>
      </section>

      {/* Run / Cancel */}
      <button
        data-enter
        ref={runRef}
        onClick={isLoading ? onCancel : run}
        disabled={!isLoading && !canRun}
        className={`group h-11 w-full rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed ${
          isLoading
            ? 'border border-line bg-surface text-fg hover:border-bad/50 hover:text-bad'
            : 'bg-accent text-accent-fg shadow-lg shadow-accent/25 hover:brightness-110'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin group-hover:hidden" />
            <Square size={13} fill="currentColor" className="hidden group-hover:block" />
            <span className="group-hover:hidden">Scraping…</span>
            <span className="hidden group-hover:inline">Cancel scrape</span>
          </>
        ) : (
          <>
            <Play size={15} fill="currentColor" /> Run scraper
            <span className="kbd ml-1 hidden sm:inline-flex">Ctrl ↵</span>
          </>
        )}
      </button>

      {/* Activity log */}
      <section data-enter className="card flex flex-col min-h-[160px] overflow-hidden">
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-line">
          <span className="label flex items-center gap-1.5">
            <ScrollText size={14} /> Activity
          </span>
          {logs.length > 0 && (
            <button onClick={onClearLogs} className="btn-ghost h-7 text-xs">
              <Trash2 size={13} /> Clear
            </button>
          )}
        </div>
        <div ref={logListRef} className="flex-1 overflow-y-auto max-h-56 p-3 space-y-1.5 font-mono text-[12px]">
          {logs.length === 0 ? (
            <div className="text-faint text-xs font-sans">No activity yet.</div>
          ) : (
            logs.map((log, i) => (
              <div key={`${log.time}-${logs.length - i}`} className="flex gap-2.5 leading-relaxed">
                <span className="text-faint shrink-0 tabular-nums">{log.time}</span>
                <span className={`shrink-0 w-16 truncate ${LOG_TONE[log.type] || LOG_TONE.info}`}>{log.badge}</span>
                <span className="text-muted break-words min-w-0">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
