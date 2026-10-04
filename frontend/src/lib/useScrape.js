import { useCallback, useReducer, useRef } from 'react';
import { readNdjson } from './ndjson';

export const STEPS = ['fetch', 'distill', 'infer', 'validate'];

const initial = {
  status: 'idle', // idle | running | done | error
  step: null,
  startedAt: null, // performance.now() when the run started
  request: null, // { url, schema, maxPages }
  pages: [], // { n, url, status, records, html, text, parts, startedAt, seconds }
  current: {}, // { page, maxPages, part, parts, attempt, maxAttempts }
  total: 0, // records found so far
  retries: 0,
  fallbackModel: null,
  warnings: [],
  logs: [], // { t, kind, msg }, oldest first
  shots: {}, // page number -> { image, width, height }
  result: null, // { data, items, pages, elapsed }
  error: null, // { message, step, elapsed }
};

const since = (state) => (state.startedAt ? (performance.now() - state.startedAt) / 1000 : 0);
const log = (state, kind, msg) => [...state.logs.slice(-199), { t: since(state), kind, msg }];
const updatePage = (pages, n, patch) => pages.map((p) => (p.n === n ? { ...p, ...patch } : p));
const host = (url) => {
  try {
    return new URL(url).pathname + new URL(url).search || '/';
  } catch {
    return url;
  }
};

function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return {
        ...initial,
        status: 'running',
        step: 'fetch',
        startedAt: action.startedAt,
        request: action.request,
        logs: [{ t: 0, kind: 'start', msg: `Scraping ${action.request.url}${action.request.maxPages > 1 ? ` · up to ${action.request.maxPages} pages` : ''}` }],
      };

    case 'event': {
      const e = action.event;
      const page = state.current.page || 1;
      if (e.type === 'step') {
        let next = { ...state, step: e.step === 'done' ? state.step : e.step };
        if (e.step === 'fetch') {
          const n = e.page || 1;
          const now = performance.now();
          const pages = state.pages.map((p) =>
            p.status === 'running' ? { ...p, status: 'done', seconds: (now - p.startedAt) / 1000 } : p
          );
          pages.push({ n, url: e.url || state.request.url, status: 'running', records: 0, html: 0, text: 0, parts: null, partText: {}, startedAt: now });
          next = { ...next, pages, current: { page: n, maxPages: e.max_pages || 1 } };
          if (n > 1) next.logs = log(state, 'next', `Following next link → ${host(e.url)}`);
        } else if (e.step === 'distill') {
          next.pages = updatePage(state.pages, page, { html: e.html_chars });
          next.logs = log(state, 'fetch', `Page ${page} loaded · ${(e.html_chars / 1024).toFixed(1)} KB of HTML`);
        } else if (e.step === 'infer') {
          const p = state.pages.find((x) => x.n === page) || {};
          const partText = { ...(p.partText || {}), [e.part || 1]: e.text_chars };
          const text = Object.values(partText).reduce((a, b) => a + b, 0);
          next.pages = updatePage(state.pages, page, { partText, text, parts: e.parts || null });
          next.current = { ...state.current, part: e.part || null, parts: e.parts || null, attempt: e.attempt, maxAttempts: e.max_attempts };
          const where = e.parts ? `part ${e.part} of ${e.parts} · ` : '';
          const retry = e.attempt > 1 ? ` · attempt ${e.attempt} of ${e.max_attempts}` : '';
          next.logs = log(state, 'ai', `Extracting ${where}${e.text_chars.toLocaleString()} chars of text${retry}`);
        }
        return next;
      }
      if (e.type === 'screenshot') {
        return { ...state, shots: { ...state.shots, [e.page]: { image: e.image, width: e.width, height: e.height } } };
      }
      if (e.type === 'retry') {
        return { ...state, retries: state.retries + 1, logs: log(state, 'retry', `Attempt ${e.attempt} didn't match your fields: ${e.error}`) };
      }
      if (e.type === 'part_done') {
        const before = state.pages.filter((p) => p.n !== page).reduce((a, p) => a + p.records, 0);
        const msgs = [`Part ${e.part} of ${e.parts} · ${e.items} new records (${before + e.total_items} total)`];
        let logs = log(state, 'part', msgs[0]);
        if (e.stopped) logs = [...logs, { t: since(state), kind: 'part', msg: `No records in part ${e.part}; the list has ended` }];
        return { ...state, total: before + e.total_items, pages: updatePage(state.pages, page, { records: e.total_items }), logs };
      }
      if (e.type === 'page_done') {
        const p = state.pages.find((x) => x.n === e.page);
        const seconds = p ? (performance.now() - p.startedAt) / 1000 : null;
        return {
          ...state,
          total: e.total_items,
          pages: updatePage(state.pages, e.page, { records: e.items, status: 'done', seconds }),
          logs: log(state, 'check', `Page ${e.page} · ${e.items} records match your fields`),
        };
      }
      if (e.type === 'warning') {
        const fallback = e.message.match(/so (\S+) answered/);
        return {
          ...state,
          warnings: [...state.warnings, e.message],
          fallbackModel: fallback ? fallback[1] : state.fallbackModel,
          logs: log(state, 'warn', e.message),
        };
      }
      return state;
    }

    case 'done': {
      const pages = state.pages.map((p) => (p.status === 'running' ? { ...p, status: 'done', seconds: (performance.now() - p.startedAt) / 1000 } : p));
      const r = action.result;
      return {
        ...state,
        status: 'done',
        step: 'done',
        pages,
        total: r.items,
        warnings: r.warnings,
        result: r,
        logs: log(state, 'done', `Done · ${r.items} records${r.pages > 1 ? ` from ${r.pages} pages` : ''} in ${r.elapsed}s`),
      };
    }

    case 'error':
      return {
        ...state,
        status: 'error',
        error: { message: action.message, step: action.step, elapsed: since(state) },
        logs: log(state, 'error', action.message),
      };

    case 'cancel':
      return { ...state, status: 'idle', logs: log(state, 'stop', 'Stopped') };

    case 'load':
      return { ...initial, ...action.state };

    default:
      return state;
  }
}

/**
 * Runs scrapes against the backend's /scrape/stream endpoint and keeps the
 * live state the UI shows (pages, parts, attempts, records, log).
 */
export function useScrape() {
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef(null);
  const stepRef = useRef('fetch');

  const run = useCallback(async (params, { onDone } = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    stepRef.current = 'fetch';
    const maxPages = params.expectList ? params.maxPages : 1;
    dispatch({ type: 'start', startedAt: performance.now(), request: { url: params.url, schema: params.schema, maxPages } });

    try {
      const base = (params.backendUrl || 'http://localhost:8001').replace(/\/$/, '');
      const response = await fetch(`${base}/scrape/stream`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: params.url.trim(),
          schema_description: params.schema.trim(),
          instruction: params.schema.trim(),
          max_retries: params.retries,
          expect_list: params.expectList,
          scroll: params.scroll,
          max_scrolls: params.maxScrolls,
          max_pages: maxPages,
          headless: params.headless,
          model: params.model || null,
          api_key: params.apiKey || null,
          max_chars: params.maxChars || null,
          screenshots: true,
        }),
      });

      if (response.status === 404) {
        throw new Error(`The backend at ${base} has no /scrape/stream endpoint, so it is running older code. Restart the backend to pick up the latest version.`);
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        let message = `Server returned HTTP ${response.status}`;
        if (typeof body.detail === 'string') message = body.detail;
        else if (Array.isArray(body.detail)) message = body.detail.map((d) => d.msg || d.message || JSON.stringify(d)).join('; ');
        throw new Error(message);
      }

      let final = null;
      for await (const event of readNdjson(response)) {
        if (event.type === 'result' || event.type === 'error') final = event;
        else {
          if (event.type === 'step' && event.step !== 'done') stepRef.current = event.step;
          dispatch({ type: 'event', event });
        }
      }

      if (!final) throw new Error('Lost connection to the backend before the scrape finished.');
      if (final.type === 'error') {
        const err = new Error(final.message || 'Scrape failed.');
        err.step = final.step;
        throw err;
      }

      const result = {
        data: final.data,
        items: final.items_count,
        pages: final.pages_scraped || 1,
        elapsed: String(final.elapsed_seconds),
        warnings: final.warnings || [],
      };
      dispatch({ type: 'done', result });
      onDone?.(result);
    } catch (err) {
      if (err.name === 'AbortError') {
        // Closing the stream also stops the scrape on the backend.
        dispatch({ type: 'cancel' });
        return;
      }
      const failed = err.step || stepRef.current;
      dispatch({ type: 'error', message: err.message || 'Scrape failed.', step: STEPS.includes(failed) ? failed : 'fetch' });
    }
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  /** Show a saved run's results. */
  const load = useCallback((run) => {
    dispatch({
      type: 'load',
      state: {
        status: 'done',
        step: 'done',
        request: { url: run.url, schema: run.schema, maxPages: run.pagesScraped || 1 },
        total: run.itemsCount,
        warnings: run.warnings || [],
        result: { data: run.data, items: run.itemsCount, pages: run.pagesScraped || 1, elapsed: run.elapsed, warnings: run.warnings || [] },
        pages: [],
        logs: [{ t: 0, kind: 'start', msg: `Loaded saved run from ${run.timestamp}` }],
      },
    });
  }, []);

  const reset = useCallback(() => dispatch({ type: 'load', state: {} }), []);

  return { state, run, cancel, load, reset };
}
