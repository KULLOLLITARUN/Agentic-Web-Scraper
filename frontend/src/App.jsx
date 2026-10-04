import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import Composer, { PRESETS, buildRequest, toField } from './components/Composer';
import PagePanel from './components/PagePanel';
import FoundPanel from './components/FoundPanel';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import { useScrape } from './lib/useScrape';
import { parseFields } from './lib/schema';
import { appTitle } from './lib/brand';

const LEGACY_DEFAULT_MODEL = 'qwen/qwen3.8-27b';

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private window); keep working without it
  }
}

const fieldsOf = (schema) => (parseFields(schema)?.fields || []).map(toField);
const withScheme = (url) => (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
const hostOf = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

export default function App() {
  const first = PRESETS[0];
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  const [url, setUrl] = useState(hostOf(first.url));
  const [what, setWhat] = useState(first.what);
  const [fields, setFields] = useState(() => fieldsOf(first.schema));
  const [useFields, setUseFields] = useState(false);
  const [options, setOptions] = useState({ retries: 3, expectList: true, scroll: true, maxScrolls: 5, loadMore: 3, maxPages: 1, headless: true });
  const [pane, setPane] = useState('found'); // phones: which panel is showing
  const [focus, setFocus] = useState(null); // record shown on both the page and in the results
  const [flash, setFlash] = useState({ i: null, n: 0 }); // a record clicked in the results: its mark blinks
  const [config, setConfig] = useState({ apiKey: '', model: '', backendUrl: 'http://localhost:8001', maxChars: 40000 });
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]); // requests kept to run again: { id, url, what, fields, useFields, options }
  const [runCount, setRunCount] = useState(0); // every run ever started here, for 'No. 0042'
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const scrape = useScrape();
  const { state } = scrape;

  useEffect(() => {
    document.title = appTitle();
    const savedHistory = loadJson('ai_scraper_history');
    if (Array.isArray(savedHistory)) setHistory(savedHistory);
    const savedRequests = loadJson('ai_scraper_saved');
    if (Array.isArray(savedRequests)) setSaved(savedRequests);
    // History keeps only the last 25 runs, so the run number has its own counter.
    setRunCount(Number(loadJson('ai_scraper_run_count')) || (Array.isArray(savedHistory) ? savedHistory.length : 0));
    const saved = loadJson('ai_scraper_config');
    if (saved) {
      // The old UI saved its placeholder model as if the user chose it; treat it as "auto".
      if (!saved.version && saved.model === LEGACY_DEFAULT_MODEL) saved.model = '';
      // Long pages are now read in parts, so the old one-request default of 12,000 moves up.
      if ((saved.version || 0) < 3 && Number(saved.maxChars) === 12000) saved.maxChars = 40000;
      // The backend moved from port 8000 (often taken by other apps) to 8001.
      if ((saved.version || 0) < 4 && /^https?:\/\/(localhost|127\.0\.0\.1):8000\/?$/.test(saved.backendUrl || '')) {
        saved.backendUrl = saved.backendUrl.replace(':8000', ':8001');
      }
      setConfig((prev) => ({ ...prev, ...saved }));
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('studio_theme', theme);
    } catch {
      // storage unavailable; theme still applies for this session
    }
  }, [theme]);

  // On phones, follow the run: the page while it's read, then the results.
  useEffect(() => {
    if (state.status === 'running') setFocus(null);
    if (state.status === 'running') setFlash((f) => ({ i: null, n: f.n }));
    if (state.status === 'running') setPane('page');
    else if (state.status === 'done' || state.status === 'error') setPane('found');
  }, [state.status]);

  const request = buildRequest(what, fields, useFields);

  // A saved request runs with its own values; the form shows them too.
  const run = (from = null) => {
    const src = from || { url, what, fields, useFields, options };
    const schema = buildRequest(src.what, src.fields, src.useFields);
    if (!src.url.trim() || !schema) return;
    const target = withScheme(src.url);
    setRunCount((n) => {
      saveJson('ai_scraper_run_count', n + 1);
      return n + 1;
    });
    const snapshot = { what: src.what, fields: src.fields, useFields: src.useFields };
    scrape.run(
      { url: target, schema, ...src.options, backendUrl: config.backendUrl, model: config.model, apiKey: config.apiKey, maxChars: config.maxChars },
      {
        onDone: (result) => {
          const entry = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            url: target,
            schema,
            ...snapshot,
            itemsCount: result.items,
            pagesScraped: result.pages,
            elapsed: result.elapsed,
            data: result.data,
            warnings: result.warnings,
          };
          setHistory((prev) => {
            const next = [entry, ...prev.slice(0, 24)];
            saveJson('ai_scraper_history', next);
            return next;
          });
        },
      }
    );
  };

  const sameRequest = (a, b) => withScheme(a.url) === withScheme(b.url) && buildRequest(a.what, a.fields, a.useFields) === buildRequest(b.what, b.fields, b.useFields);
  /** Keep the form's request to run again; 'exists' when it's already kept. */
  const saveRequest = () => {
    const entry = { id: Date.now(), url: withScheme(url), what, fields, useFields, options };
    if (saved.some((s) => sameRequest(s, entry))) return 'exists';
    const next = [entry, ...saved].slice(0, 50);
    setSaved(next);
    saveJson('ai_scraper_saved', next);
    return 'saved';
  };
  const deleteSaved = (id) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    saveJson('ai_scraper_saved', next);
  };
  const loadSaved = (entry, andRun = false) => {
    setUrl(hostOf(entry.url));
    setWhat(entry.what);
    setFields(entry.fields);
    setUseFields(entry.useFields);
    setOptions((o) => ({ ...o, ...entry.options }));
    setIsHistoryOpen(false);
    if (andRun) run({ ...entry, options: { ...options, ...entry.options } });
    else requestAnimationFrame(() => document.querySelector('[aria-label="What to extract"]')?.focus());
  };

  const pickExample = (p) => {
    setUrl(hostOf(p.url));
    setWhat(p.what);
    setFields(fieldsOf(p.schema));
  };

  const openRun = (entry) => {
    setUrl(hostOf(entry.url));
    setWhat(entry.what ?? entry.schema);
    setFields(entry.fields ?? fieldsOf(entry.schema));
    setUseFields(entry.useFields ?? false);
    scrape.load(entry);
    setIsHistoryOpen(false);
  };

  const showPanes = state.status !== 'idle' || !!state.result;
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;
  // Picked in the results: show it on the page and blink its mark (phones switch panel).
  const pickFromResults = (i) => {
    setFocus(i);
    setFlash((f) => ({ i, n: f.n + 1 }));
    if (isPhone()) setPane('page');
  };
  // Picked on the page: show its card or row (phones switch panel).
  const pickFromPage = (i) => {
    setFocus(i);
    if (isPhone()) setPane('found');
    requestAnimationFrame(() => document.querySelector(`[data-row][data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const found = state.status === 'running' ? state.total : state.result?.items ?? 0;

  return (
    <div className="min-h-screen">
      <Header
        runNumber={showPanes && runCount ? runCount : null}
        onHome={() => scrape.reset()}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <Composer
        url={url}
        setUrl={setUrl}
        what={what}
        setWhat={setWhat}
        fields={fields}
        setFields={setFields}
        useFields={useFields}
        setUseFields={setUseFields}
        options={options}
        setOption={(key, value) => setOptions((o) => ({ ...o, [key]: value }))}
        running={state.status === 'running'}
        onRun={() => run()}
        onStop={scrape.cancel}
        onSave={saveRequest}
      />

      {showPanes && (
        <div className="md:hidden sticky top-[54px] z-20 bg-bg px-4 py-2 border-b border-line">
          <div role="tablist" className="flex border border-line2 rounded-md overflow-hidden">
            {[['page', 'The page'], ['found', `Found ${found}`]].map(([id, text], i) => (
              <button key={id} role="tab" aria-selected={pane === id} onClick={() => setPane(id)}
                className={`flex-1 py-2 text-[13px] ${i ? 'border-l border-line2' : ''} ${pane === id ? 'bg-fg text-bg' : 'bg-surface text-muted'}`}>
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-7 px-4 md:px-7 pt-3.5 md:pt-5 pb-28 md:pb-10">
        <section className={pane === 'page' || !showPanes ? 'block' : 'hidden md:block'}>
          <div className="flex items-baseline justify-between gap-3 mb-2.5">
            <h2 className="m-0 text-[13px] font-semibold text-muted">The page</h2>
            {state.request && <span className="text-xs text-faint truncate">{hostOf(state.request.url)}</span>}
          </div>
          <PagePanel state={state} focus={focus} flash={flash} onFocus={setFocus} onPick={pickFromPage} />
        </section>
        <section className={`${pane === 'found' || !showPanes ? 'block' : 'hidden md:block'} ${showPanes ? '' : 'mt-6 md:mt-0'}`}>
          <div className="flex items-baseline justify-between gap-3 mb-2.5">
            <h2 className="m-0 text-[13px] font-semibold text-muted">What it found</h2>
          </div>
          <FoundPanel
            state={state}
            onRerun={() => run()}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onPickExample={pickExample}
            onRetry={() => run()}
            saved={saved}
            onRunSaved={(entry) => loadSaved(entry, true)}
            onEdit={() => document.querySelector('[aria-label="What to extract"]')?.focus()}
            focus={focus}
            onFocus={setFocus}
            onPick={pickFromResults}
          />
        </section>
      </main>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectRun={openRun}
        saved={saved}
        onRunSaved={(entry) => loadSaved(entry, true)}
        onEditSaved={(entry) => loadSaved(entry)}
        onDeleteSaved={deleteSaved}
        onClearHistory={() => {
          setHistory([]);
          try {
            localStorage.removeItem('ai_scraper_history');
          } catch {
            // nothing to clear
          }
        }}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} config={config} onSave={(next) => { setConfig(next); saveJson('ai_scraper_config', { ...next, version: 4 }); }} />
    </div>
  );
}
