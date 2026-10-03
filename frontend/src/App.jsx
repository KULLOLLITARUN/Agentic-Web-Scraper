import React, { useState, useEffect, useRef } from 'react';
import StatusBar from './components/StatusBar';
import PipelineStepper from './components/PipelineStepper';
import ConfigPanel from './components/ConfigPanel';
import InspectorPanel from './components/InspectorPanel';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';
import { readNdjson } from './lib/ndjson';

const STEP_ORDER = ['fetch', 'distill', 'infer', 'validate'];
const DEFAULT_URL = 'https://quotes.toscrape.com';
const LEGACY_DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const DEFAULT_SCHEMA = 'Each quote: text (string), author (string), tags (list of strings)';

export default function App() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const [url, setUrl] = useState(DEFAULT_URL);
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [retries, setRetries] = useState(3);
  const [expectList, setExpectList] = useState(true);
  const [scroll, setScroll] = useState(true);
  const [maxScrolls, setMaxScrolls] = useState(5);
  const [headless, setHeadless] = useState(true);

  // Runtime states
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [currentStep, setCurrentStep] = useState('idle'); // fetch | distill | infer | validate | done
  const stepRef = useRef('idle');
  const abortRef = useRef(null);
  const [errorStep, setErrorStep] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Telemetry & metrics
  const [metrics, setMetrics] = useState({ elapsed: 0, itemsCount: 0 });

  // Logs feed
  const [logs, setLogs] = useState([]);

  // History & settings
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState({
    apiKey: '',
    model: '',
    backendUrl: 'http://localhost:8000',
    maxChars: 12000
  });

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('ai_scraper_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedConfig = localStorage.getItem('ai_scraper_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        // The old UI saved its placeholder model as if the user chose it; treat it as "auto".
        if (!parsed.version && parsed.model === LEGACY_DEFAULT_MODEL) parsed.model = '';
        setConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Failed to load local storage:', e);
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

  const handleToggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const addLog = (message, type = 'info', badge = 'STEP') => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLogs((prev) => [{ time, message, type, badge }, ...prev.slice(0, 49)]);
  };

  const handleRun = async () => {
    if (!url || !schema) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('running');
    setResultData(null);
    setErrorMessage(null);
    setWarnings([]);
    setErrorStep(null);
    setAttempt(null);
    setCurrentStep('fetch');
    stepRef.current = 'fetch';

    const startTime = performance.now();
    addLog(`Starting scrape of ${url}`, 'info', 'START');

    try {
      const base = (config.backendUrl || 'http://localhost:8000').replace(/\/$/, '');
      const response = await fetch(`${base}/scrape/stream`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          schema_description: schema.trim(),
          instruction: schema.trim(),
          max_retries: retries,
          expect_list: expectList,
          scroll: scroll,
          max_scrolls: maxScrolls,
          headless: headless,
          model: config.model || null,
          api_key: config.apiKey || null,
          max_chars: config.maxChars || null
        })
      });

      if (response.status === 404) {
        throw new Error(
          `The backend at ${base} has no /scrape/stream endpoint, so it is running older code. Restart the backend to pick up the latest version.`
        );
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errMsg = `Server returned HTTP ${response.status}`;
        if (typeof errorData.detail === 'string') {
          errMsg = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errMsg = errorData.detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ');
        }
        throw new Error(errMsg);
      }

      let final = null;
      for await (const event of readNdjson(response)) {
        if (event.type === 'step') {
          handleStepEvent(event);
        } else if (event.type === 'retry') {
          addLog(`Attempt ${event.attempt} of ${event.max_attempts} failed validation: ${event.error}`, 'retry', 'RETRY');
        } else if (event.type === 'warning') {
          addLog(event.message, 'warn', 'WARNING');
        } else if (event.type === 'result' || event.type === 'error') {
          final = event;
        }
      }

      if (!final) throw new Error('Lost connection to the backend before the scrape finished.');
      if (final.type === 'error') {
        const err = new Error(final.message || 'Scrape failed.');
        err.step = final.step;
        throw err;
      }

      const extractedData = final.data;
      const elapsed = String(final.elapsed_seconds);
      const itemsCount = final.items_count;
      const runWarnings = final.warnings || [];

      setCurrentStep('done');
      setStatus('done');
      setResultData(extractedData);
      setWarnings(runWarnings);
      setMetrics({ elapsed, itemsCount });

      addLog(`Done: ${itemsCount} records in ${elapsed}s`, 'info', 'DONE');

      // Save to history
      const newRun = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        url,
        schema,
        itemsCount,
        elapsed,
        data: extractedData,
        warnings: runWarnings
      };
      const updatedHistory = [newRun, ...history.slice(0, 24)];
      setHistory(updatedHistory);
      localStorage.setItem('ai_scraper_history', JSON.stringify(updatedHistory));

    } catch (err) {
      if (err.name === 'AbortError') {
        // Cancelled by the user; closing the stream also stops the backend.
        setStatus('idle');
        setCurrentStep('idle');
        setAttempt(null);
        setMetrics({ itemsCount: 0, elapsed: ((performance.now() - startTime) / 1000).toFixed(2) });
        addLog('Scrape cancelled.', 'warn', 'CANCELLED');
        return;
      }
      // The backend reports which step failed; otherwise blame the step we last saw.
      const failed = err.step || stepRef.current;
      setStatus('error');
      setErrorStep(STEP_ORDER.includes(failed) ? failed : 'fetch');
      setErrorMessage(err.message || 'Scrape execution failed.');

      setMetrics({ itemsCount: 0, elapsed: ((performance.now() - startTime) / 1000).toFixed(2) });

      addLog(err.message || 'Scrape failed', 'error', 'ERROR');
    }
  };

  const handleStepEvent = (event) => {
    stepRef.current = event.step;
    if (event.step !== 'done') setCurrentStep(event.step);
    if (event.attempt) setAttempt({ current: event.attempt, max: event.max_attempts });

    if (event.step === 'distill') {
      addLog(`Page loaded (${event.html_chars.toLocaleString()} chars of HTML). Cleaning…`, 'info', 'CLEAN');
    } else if (event.step === 'infer') {
      const suffix = event.attempt > 1 ? ` (attempt ${event.attempt} of ${event.max_attempts})` : '';
      addLog(`Extracting fields from ${event.text_chars.toLocaleString()} chars of text${suffix}…`, 'info', 'EXTRACT');
    } else if (event.step === 'validate') {
      addLog('Validating output against your fields…', 'info', 'VALIDATE');
    }
  };

  const handleSelectHistoryRun = (run) => {
    setUrl(run.url);
    setSchema(run.schema);
    setResultData(run.data);
    setWarnings(run.warnings || []);
    setAttempt(null);
    setStatus('done');
    setCurrentStep('done');
    setErrorStep(null);
    setErrorMessage(null);
    setMetrics({ elapsed: run.elapsed, itemsCount: run.itemsCount });
    addLog(`Loaded saved run for ${run.url}`, 'info', 'HISTORY');
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('ai_scraper_history');
    addLog('Run history cleared.', 'info', 'HISTORY');
  };

  const handleSaveConfig = (newConfig) => {
    setConfig(newConfig);
    localStorage.setItem('ai_scraper_config', JSON.stringify({ ...newConfig, version: 2 }));
    addLog('Settings saved.', 'info', 'SETTINGS');
  };

  return (
        <div className="h-screen w-full flex flex-col overflow-hidden">
      <StatusBar
        status={status}
        metrics={metrics}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <div className="w-full lg:w-[40%] lg:min-w-[380px] lg:max-w-[520px] shrink-0 lg:border-r border-line">
          <ConfigPanel
            url={url}
            setUrl={setUrl}
            schema={schema}
            setSchema={setSchema}
            retries={retries}
            setRetries={setRetries}
            expectList={expectList}
            setExpectList={setExpectList}
            scroll={scroll}
            setScroll={setScroll}
            maxScrolls={maxScrolls}
            setMaxScrolls={setMaxScrolls}
            headless={headless}
            setHeadless={setHeadless}
            onRun={handleRun}
            onCancel={() => abortRef.current?.abort()}
            isLoading={status === 'running'}
            logs={logs}
            onClearLogs={() => setLogs([])}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-[520px] lg:min-h-0 border-t lg:border-t-0 border-line bg-dots">
          <PipelineStepper
            currentStep={currentStep}
            errorStep={errorStep}
            attempt={attempt}
          />

          <div className="flex-1 min-h-0">
            <InspectorPanel
              data={resultData}
              isLoading={status === 'running'}
              error={errorMessage}
              warnings={warnings}
            />
          </div>
        </div>
      </main>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectRun={handleSelectHistoryRun}
        onClearHistory={handleClearHistory}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
