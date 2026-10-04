import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Layers, Plus, SlidersHorizontal, X } from 'lucide-react';
import { motion, popIn } from '../lib/motion';
import { TYPES, buildSchema, parseFields, toFieldName, typeLabel, withType } from '../lib/schema';
import { useReveal } from './ui';

export const PRESETS = [
  { name: 'Quotes', url: 'https://quotes.toscrape.com', schema: 'Each quote: text (string), author (string), tags (list of strings)', note: '10 per page' },
  { name: 'Books', url: 'https://books.toscrape.com', schema: 'Each book: title (string), price (float, no currency symbol), rating (string), in_stock (boolean)', note: '20 per page' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com', schema: 'Each story: rank (int), title (string), url (string), points (int or null), comments_count (int or null)', note: '30 per page' },
  {
    name: 'Naukri Jobs',
    url: 'https://www.naukri.com/ai-ml-engineer-jobs-in-bangalore?k=ai%20ml%20engineer&l=bangalore&nignbevent_src=jobsearchDeskGNB',
    schema: 'Each job: title (string), company (string), experience (string), salary (string), location (string), skills (list of strings)',
    note: '~20 jobs',
  },
];

const TYPE_STYLE = {
  string: 'bg-accent/15 text-accent',
  float: 'bg-ok/15 text-ok',
  int: 'bg-ok/15 text-ok',
  bool: 'bg-accent2/15 text-accent2',
  list: 'bg-warn/15 text-warn',
  any: 'bg-subtle text-faint border border-line',
};

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
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span ref={knob} className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow" />
    </button>
  );
}

function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-0.5 rounded-md bg-subtle border border-line">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${value === o.value ? 'bg-surface text-fg font-medium shadow-sm' : 'text-muted hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldChip({ field, onType, onRemove, isNew }) {
  const ref = useRef(null);
  useEffect(() => {
    if (isNew) popIn(ref.current);
  }, [isNew]);
  return (
    <span ref={ref} className="chip pl-2.5 pr-1 py-1">
      <span className="font-medium">{field.name}</span>
      <label className={`relative type-tag cursor-pointer focus-within:ring-2 focus-within:ring-fg/20 ${TYPE_STYLE[field.type]}`}>
        <span className="sr-only">Type of {field.name}: </span>
        {typeLabel(field.type)}
        <select value={field.type} onChange={(e) => onType(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer">
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onRemove} className="w-5 h-5 grid place-items-center rounded-md text-faint hover:text-fg hover:bg-line/60" aria-label={`Remove ${field.name}`}>
        <X size={12} />
      </button>
    </span>
  );
}

function FieldsEditor({ schema, setSchema }) {
  const parsed = parseFields(schema);
  const [textMode, setTextMode] = useState(parsed === null);
  const [draft, setDraft] = useState('');
  const [draftType, setDraftType] = useState('string');
  const [lastAdded, setLastAdded] = useState(null);
  const canChip = parsed !== null;
  const showText = textMode || !canChip;

  const update = (fields) => setSchema(buildSchema(parsed.prefix, fields));
  const add = () => {
    const name = toFieldName(draft);
    if (!name || parsed.fields.some((f) => f.name === name)) return;
    const field = withType({ name, spec: '', type: 'any' }, draftType);
    update([...parsed.fields, field]);
    setLastAdded(name);
    setDraft('');
  };

  return (
    <div className="px-4 sm:px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow"><span className="text-faint mr-3">02</span>{showText ? 'Describe each record' : `${parsed.prefix} has`}</span>
        <button
          type="button"
          onClick={() => setTextMode(!showText)}
          disabled={!canChip}
          className="text-xs text-muted hover:text-fg disabled:opacity-50"
          title={canChip ? '' : 'Use "name (type), name (type)" to edit as chips'}
        >
          {showText ? 'Edit as fields' : 'Write as text'}
        </button>
      </div>

      {showText ? (
        <textarea
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
          rows={3}
          className="field resize-none leading-relaxed"
          placeholder="Each book: title (string), price (float), in_stock (boolean)"
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {parsed.fields.map((f, i) => (
            <FieldChip
              key={f.name}
              field={f}
              isNew={f.name === lastAdded}
              onType={(type) => update(parsed.fields.map((x, j) => (j === i ? withType(x, type) : x)))}
              onRemove={() => update(parsed.fields.filter((_, j) => j !== i))}
            />
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="chip border-dashed !bg-transparent pl-2 pr-1 py-0.5 focus-within:border-accent/60"
          >
            <Plus size={13} className="text-faint" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add field"
              aria-label="New field name"
              className="w-24 bg-transparent outline-none text-[13px] placeholder:text-faint py-1"
            />
            {draft && (
              <>
                <label className={`relative type-tag cursor-pointer ${TYPE_STYLE[draftType]}`}>
                {typeLabel(draftType)}
                <select value={draftType} onChange={(e) => setDraftType(e.target.value)} aria-label="New field type" className="absolute inset-0 opacity-0 cursor-pointer">
                  {TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                </label>
                <button type="submit" className="text-xs px-2 py-0.5 rounded-md bg-accent text-accent-fg">
                  Add
                </button>
              </>
            )}
          </form>
        </div>
      )}
      {!showText && parsed.fields.some((f) => f.type === 'any') && (
        <p className="text-xs text-warn">Fields marked “any” have no type, so any value is accepted. Pick a type to have it checked.</p>
      )}
    </div>
  );
}

export default function Composer({ url, setUrl, schema, setSchema, options, setOption, onRun, model, onBackToResults }) {
  const [showMore, setShowMore] = useState(false);
  const heroRef = useReveal('hero', { step: 80, distance: 16 });
  const moreRef = useRef(null);
  const canRun = url.trim() && schema.trim();

  useEffect(() => {
    if (showMore) motion(moreRef.current, { opacity: [0, 1], translateY: [-6, 0], duration: 300, ease: 'outQuart' });
  }, [showMore]);

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canRun) {
      e.preventDefault();
      onRun();
    }
  };

  return (
    <section className="max-w-[920px] mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-24" onKeyDown={onKeyDown}>
      <div ref={heroRef} className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New scrape</h1>
          <p className="text-sm text-muted mt-1">A page URL and the fields you want from each record. Results are checked against the field types.</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {onBackToResults && (
            <button onClick={onBackToResults} className="text-fg underline underline-offset-2 hover:text-accent">
              Back to results
            </button>
          )}
          <span className="font-mono text-faint">model: {model}</span>
        </div>
      </div>

      {/* Composer */}
      <div className="card">
        <label className="flex items-center gap-3 px-4 sm:px-5 h-14 border-b border-line">
          <span className="font-mono text-[11px] text-faint shrink-0 w-6">01</span>
          <span className="sr-only">Page URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/products"
            className="flex-1 min-w-0 bg-transparent outline-none font-mono text-[15px] placeholder:text-faint"
            spellCheck={false}
          />
          {url && (
            <button type="button" onClick={() => setUrl('')} className="text-faint hover:text-fg" aria-label="Clear URL">
              <X size={16} />
            </button>
          )}
        </label>

        <FieldsEditor schema={schema} setSchema={setSchema} />

        <div className={`px-4 sm:px-5 py-3 border-t border-line bg-subtle/50 ${showMore ? '' : 'rounded-b-2xl'} flex flex-wrap items-center gap-2`}>
          <Segmented
            label="Result shape"
            value={options.expectList}
            onChange={(v) => setOption('expectList', v)}
            options={[
              { value: true, label: 'List' },
              { value: false, label: 'Single' },
            ]}
          />
          <label className={`inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-md border border-line bg-surface text-xs ${options.expectList ? '' : 'opacity-50'}`}>
            <Layers size={13} className="text-muted" />
            <span className="text-muted">Pages</span>
            <select
              value={options.maxPages}
              disabled={!options.expectList}
              onChange={(e) => setOption('maxPages', Number(e.target.value))}
              className="bg-transparent outline-none font-medium cursor-pointer"
            >
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'just this one' : `up to ${n}`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs transition-colors ${showMore ? 'border-accent/50 text-fg bg-surface' : 'border-line text-muted bg-surface hover:text-fg'}`}
          >
            <SlidersHorizontal size={13} /> More options
          </button>
          <button onClick={onRun} disabled={!canRun} className="btn-primary w-full sm:w-auto sm:ml-auto mt-1 sm:mt-0">
            Run scrape <ArrowRight size={15} strokeWidth={2.2} />
            <span className="kbd hidden sm:inline-flex">Ctrl ↵</span>
          </button>
        </div>

        {showMore && (
          <div ref={moreRef} className="px-4 sm:px-5 py-4 border-t border-line grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div>Retry attempts</div>
                <div className="text-xs text-faint">If the output doesn't match your fields</div>
              </div>
              <Segmented label="Retry attempts" value={options.retries} onChange={(v) => setOption('retries', v)} options={[1, 2, 3, 5].map((n) => ({ value: n, label: String(n) }))} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div>Show browser window</div>
                <div className="text-xs text-faint">Helps on sites that block bots</div>
              </div>
              <Toggle label="Show browser window" checked={!options.headless} onChange={(v) => setOption('headless', !v)} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div>Auto-scroll</div>
                <div className="text-xs text-faint">Load lazy / infinite content</div>
              </div>
              <Toggle label="Auto-scroll" checked={options.scroll} onChange={(v) => setOption('scroll', v)} />
            </div>
            <div className={`flex items-center justify-between gap-3 ${options.scroll ? '' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <div>Scrolls</div>
                <div className="text-xs text-faint">How far down to load</div>
              </div>
              <div className="flex items-center gap-2 w-40">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={options.maxScrolls}
                  onChange={(e) => setOption('maxScrolls', Number(e.target.value))}
                  className="flex-1 accent-[rgb(var(--accent))]"
                  aria-label="Scrolls"
                />
                <span className="w-6 text-right tabular-nums text-xs">{options.maxScrolls}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Examples */}
      <div className="mt-10">
        <div className="eyebrow mb-2">Examples</div>
        <Examples url={url} onPick={(p) => {
          setUrl(p.url);
          setSchema(p.schema);
        }} />
      </div>
    </section>
  );
}

function Examples({ url, onPick }) {
  const ref = useReveal('examples', { step: 50, distance: 6 });
  return (
    <div ref={ref} className="card divide-y divide-line overflow-hidden">
      {PRESETS.map((p) => {
        const active = url === p.url;
        const fields = (parseFields(p.schema)?.fields || []).map((f) => f.name);
        return (
          <button
            key={p.name}
            type="button"
            onClick={() => onPick(p)}
            className={`w-full flex items-center gap-4 px-4 py-2.5 text-left text-sm transition-colors ${active ? 'bg-subtle' : 'hover:bg-subtle/60'}`}
          >
            <span className="font-medium flex items-center gap-2 w-32 shrink-0">
              <span className={`w-1.5 h-1.5 ${active ? 'bg-accent' : 'bg-line'}`} />
              {p.name}
            </span>
            <span className="hidden md:block font-mono text-xs text-muted w-48 shrink-0 truncate">{new URL(p.url).hostname.replace(/^www\./, '')}</span>
            <span className="flex-1 min-w-0 font-mono text-xs text-faint truncate">{fields.join(', ')}</span>
            <span className="hidden sm:block text-xs text-faint shrink-0">{p.note}</span>
          </button>
        );
      })}
    </div>
  );
}
