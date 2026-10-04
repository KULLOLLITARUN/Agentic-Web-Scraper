import React, { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import Composer, { PRESETS } from './components/Composer';
import RunView from './components/RunView';
import ResultsView from './components/ResultsView';
import ErrorView from './components/ErrorView';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import { useScrape } from './lib/useScrape';

const LEGACY_DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const DEFAULT_MODEL = 'openai/gpt-oss-120b'; // first in MODELS, scraper/brain.py

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

export default function App() {
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  const [url, setUrl] = useState(PRESETS[0].url);
  const [schema, setSchema] = useState(PRESETS[0].schema);
  const [options, setOptions] = useState({ retries: 3, expectList: true, scroll: true, maxScrolls: 5, maxPages: 1, headless: true });
  const [view, setView] = useState('compose'); // compose | run | results | error
  const [config, setConfig] = useState({ apiKey: '', model: '', backendUrl: 'http://localhost:8000', maxChars: 40000 });
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const scrape = useScrape();
  const { state } = scrape;

  useEffect(() => {
    const savedHistory = loadJson('ai_scraper_history');
    if (Array.isArray(savedHistory)) setHistory(savedHistory);
    const saved = loadJson('ai_scraper_config');
    if (saved) {
      // The old UI saved its placeholder model as if the user chose it; treat it as "auto".
      if (!saved.version && saved.model === LEGACY_DEFAULT_MODEL) saved.model = '';
      // Long pages are now read in parts, so the old one-request default of 12,000 moves up.
      if ((saved.version || 0) < 3 && Number(saved.maxChars) === 12000) saved.maxChars = 40000;
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

  // Follow the run: show progress, then results or the error.
  useEffect(() => {
    if (state.status === 'running') setView('run');
    else if (state.status === 'done') setView((v) => (v === 'run' ? 'results' : v));
    else if (state.status === 'error') setView('error');
    else if (state.status === 'idle') setView((v) => (v === 'run' ? 'compose' : v));
  }, [state.status]);

  const model = config.model || DEFAULT_MODEL;

  const run = () => {
    if (!url.trim() || !schema.trim()) return;
    scrape.run(
      { url, schema, ...options, backendUrl: config.backendUrl, model: config.model, apiKey: config.apiKey, maxChars: config.maxChars },
      {
        onDone: (result) => {
          const entry = {
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            url,
            schema,
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

  const edit = () => {
    if (state.request) {
      setUrl(state.request.url);
      setSchema(state.request.schema);
    }
    setView('compose');
  };

  const openRun = (entry) => {
    setUrl(entry.url);
    setSchema(entry.schema);
    scrape.load(entry);
    setView('results');
    setIsHistoryOpen(false);
  };

  const saveConfig = (next) => {
    setConfig(next);
    saveJson('ai_scraper_config', { ...next, version: 3 });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        request={view === 'compose' ? null : state.request}
        onEdit={edit}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main className="flex-1 bg-ruled">
        {view === 'compose' && (
          <Composer
            url={url}
            setUrl={setUrl}
            schema={schema}
            setSchema={setSchema}
            options={options}
            setOption={(key, value) => setOptions((o) => ({ ...o, [key]: value }))}
            onRun={run}
            model={model.replace(/^openai\//, '')}
            onBackToResults={state.result ? () => setView('results') : null}
          />
        )}
        {view === 'run' && <RunView state={state} model={model} onStop={scrape.cancel} />}
        {view === 'results' && <ResultsView state={state} model={model} onRerun={run} onOpenSettings={() => setIsSettingsOpen(true)} />}
        {view === 'error' && <ErrorView error={state.error} onRetry={run} onEdit={edit} />}
      </main>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectRun={openRun}
        onClearHistory={() => {
          setHistory([]);
          try {
            localStorage.removeItem('ai_scraper_history');
          } catch {
            // nothing to clear
          }
        }}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} config={config} onSave={saveConfig} />
    </div>
  );
}
