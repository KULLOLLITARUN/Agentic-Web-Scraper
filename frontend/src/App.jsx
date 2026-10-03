import React, { useState, useEffect, useRef } from 'react';
import StatusBar from './components/StatusBar';
import PipelineStepper from './components/PipelineStepper';
import ConfigPanel from './components/ConfigPanel';
import InspectorPanel from './components/InspectorPanel';
import HistoryModal from './components/HistoryModal';
import SettingsModal from './components/SettingsModal';

const DEFAULT_URL = 'https://quotes.toscrape.com';
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
  const [errorStep, setErrorStep] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

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
    model: 'qwen/qwen3.8-27b',
    backendUrl: 'http://localhost:8000',
    maxChars: 12000
  });

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('ai_scraper_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedConfig = localStorage.getItem('ai_scraper_config');
      if (savedConfig) setConfig(JSON.parse(savedConfig));
    } catch (e) {
      console.error('Failed to load local storage:', e);
    }
  }, []);

  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);

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

    setStatus('running');
    setResultData(null);
    setErrorMessage(null);
    setErrorStep(null);
    setCurrentStep('fetch');

    const startTime = performance.now();
    addLog(`Starting scrape of ${url}`, 'info', 'START');

    const stepTimers = [
      setTimeout(() => {
        setCurrentStep('distill');
        addLog('Page loaded. Cleaning HTML…', 'info', 'CLEAN');
      }, 1200),
      setTimeout(() => {
        setCurrentStep('infer');
        addLog('Extracting fields from page text…', 'info', 'EXTRACT');
      }, 2600),
      setTimeout(() => {
        setCurrentStep('validate');
        addLog('Validating output against your fields…', 'info', 'VALIDATE');
      }, 4200)
    ];

    try {
      const apiUrl = config.backendUrl 
        ? `${config.backendUrl.replace(/\/$/, '')}/scrape`
        : 'http://localhost:8000/scrape';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          schema_description: schema.trim(),
          instruction: schema.trim(),
          max_retries: retries,
          expect_list: expectList,
          scroll: scroll,
          max_scrolls: maxScrolls,
          headless: headless
        })
      });

      stepTimers.forEach(clearTimeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errMsg = 'Scrape execution failed';
        if (typeof errorData.detail === 'string') {
          errMsg = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errMsg = errorData.detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ');
        } else if (errorData.error) {
          errMsg = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
        } else {
          errMsg = `Server returned HTTP ${response.status}`;
        }
        throw new Error(errMsg);
      }

      const resJson = await response.json();
      const extractedData = resJson.data !== undefined ? resJson.data : resJson;
      const elapsed = resJson.elapsed_seconds ? String(resJson.elapsed_seconds) : ((performance.now() - startTime) / 1000).toFixed(2);
      const itemsCount = resJson.items_count !== undefined 
        ? resJson.items_count 
        : (Array.isArray(extractedData) ? extractedData.length : (extractedData ? 1 : 0));

      setCurrentStep('done');
      setStatus('done');
      setResultData(extractedData);
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
        data: extractedData
      };
      const updatedHistory = [newRun, ...history.slice(0, 24)];
      setHistory(updatedHistory);
      localStorage.setItem('ai_scraper_history', JSON.stringify(updatedHistory));

    } catch (err) {
      stepTimers.forEach(clearTimeout);
      setStatus('error');
      setErrorStep(stepRef.current === 'idle' || stepRef.current === 'done' ? 'fetch' : stepRef.current);
      setErrorMessage(err.message || 'Scrape execution failed.');

      setMetrics({ itemsCount: 0, elapsed: ((performance.now() - startTime) / 1000).toFixed(2) });

      addLog(err.message || 'Scrape failed', 'error', 'ERROR');
    }
  };

  const handleSelectHistoryRun = (run) => {
    setUrl(run.url);
    setSchema(run.schema);
    setResultData(run.data);
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
    localStorage.setItem('ai_scraper_config', JSON.stringify(newConfig));
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
            isLoading={status === 'running'}
            logs={logs}
            onClearLogs={() => setLogs([])}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0 min-h-[520px] lg:min-h-0 border-t lg:border-t-0 border-line bg-dots">
          <PipelineStepper
            currentStep={currentStep}
            errorStep={errorStep}
          />

          <div className="flex-1 min-h-0">
            <InspectorPanel
              data={resultData}
              isLoading={status === 'running'}
              error={errorMessage}
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
