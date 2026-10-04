import React, { useEffect, useRef } from 'react';
import { Square } from 'lucide-react';
import { fadeUp, motion } from '../lib/motion';
import { STEPS } from '../lib/useScrape';
import { parseFields } from '../lib/schema';
import { Beam, LiveTimer, NumberTicker, StepMark, useReveal } from './ui';

const STEP_LABEL = { fetch: 'Loading the page', distill: 'Cleaning the page', infer: 'Extracting', validate: 'Checking fields' };
const LOG_COLOR = {
  start: 'text-accent', next: 'text-accent2', ai: 'text-accent2', check: 'text-ok', part: 'text-ok', done: 'text-ok',
  warn: 'text-warn', retry: 'text-warn', error: 'text-bad', stop: 'text-bad', fetch: 'text-muted',
};

const kb = (chars) => `${(chars / 1024).toFixed(1)} KB`;
const short = (model) => (model || '').replace(/^openai\//, '');

export function stepStates(step, status) {
  const index = STEPS.indexOf(step);
  return STEPS.map((_, i) => {
    if (status === 'error' && i === index) return 'error';
    if (status === 'done' || i < index) return 'done';
    if (i === index && status === 'running') return 'live';
    return 'idle';
  });
}

function Node({ index, title, state, headline, detail, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (state === 'live') motion(ref.current, { scale: [0.97, 1], duration: 500, ease: 'outBack(2)' });
  }, [state]);
  const tone = {
    live: 'border-accent2/60 bg-accent2/[0.06]',
    done: 'border-accent/40 bg-accent/[0.05]',
    error: 'border-bad/50 bg-bad/[0.06]',
    idle: 'border-line opacity-60',
  }[state];
  return (
    <div ref={ref} className={`rounded-md border p-3.5 transition-colors duration-300 ${tone} ${wide ? 'lg:w-56' : 'lg:w-48'} lg:shrink-0`}>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span className="font-mono">
          0{index} · {title}
        </span>
        <StepMark state={state} />
      </div>
      <div className="mt-2 font-semibold truncate">{headline}</div>
      <div className="font-mono text-xs text-muted mt-0.5 truncate">{detail}</div>
      {children}
    </div>
  );
}

function Flow({ state, model }) {
  const { step, status, current, pages, total, retries, request, fallbackModel } = state;
  const s = stepStates(step, status);
  const page = pages.find((p) => p.n === current.page) || {};
  const fields = request ? parseFields(request.schema)?.fields.length : null;
  const noise = page.html && page.text ? Math.max(0, Math.round((1 - page.text / page.html) * 100)) : null;
  const beam = (i) => (s[i] === 'done' && s[i + 1] !== 'idle' ? 'done' : s[i] === 'done' ? 'live' : 'idle');
  const usedModel = fallbackModel || model;
  const progress = current.parts ? ((current.part - 1) / current.parts) * 100 + 100 / current.parts / 2 : s[2] === 'live' ? 55 : 0;

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-0">
      <Node index={1} title="PAGE" state={s[0]} headline={s[0] === 'live' ? 'Loading…' : 'Fetched'} detail={page.html ? `${kb(page.html)} HTML` : 'Opening in Chromium'} />
      <div className="hidden lg:flex flex-1 px-2"><Beam state={beam(0)} /></div>
      <div className="lg:hidden py-1"><Beam vertical state={beam(0)} /></div>

      <Node
        index={2}
        title="CLEAN"
        state={s[1]}
        headline={page.text ? `${page.text.toLocaleString()} chars` : 'Waiting'}
        detail={[noise != null && `${noise}% noise`, page.parts && `${page.parts} parts`].filter(Boolean).join(' · ') || 'Strip scripts and menus'}
      />
      <div className="hidden lg:flex flex-1 px-2"><Beam state={beam(1)} /></div>
      <div className="lg:hidden py-1"><Beam vertical state={beam(1)} /></div>

      <Node
        index={3}
        title="AI EXTRACT"
        wide
        state={s[2]}
        headline={current.parts ? `Part ${current.part} of ${current.parts}` : s[2] === 'idle' ? 'Waiting' : 'Reading the text'}
        detail={`${short(usedModel)}${current.attempt ? ` · attempt ${current.attempt}` : ''}`}
      >
        {s[2] === 'live' && (
          <div className="mt-2 h-1 rounded-full bg-line overflow-hidden">
            <div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
        )}
        {fallbackModel && <div className="mt-1.5 text-[11px] text-warn">fallback model</div>}
      </Node>
      <div className="hidden lg:flex flex-1 px-2"><Beam state={beam(2)} /></div>
      <div className="lg:hidden py-1"><Beam vertical state={beam(2)} /></div>

      <Node
        index={4}
        title="CHECK"
        state={s[3]}
        headline={s[3] === 'idle' ? 'Waiting' : s[3] === 'live' ? 'Checking…' : 'Passed'}
        detail={`${fields ? `${fields} fields` : 'JSON shape'}${retries ? ` · ${retries} ${retries === 1 ? 'retry' : 'retries'}` : ''}`}
      />
      <div className="hidden lg:flex flex-1 px-2"><Beam state={s[3] === 'done' ? 'done' : s[3] === 'live' ? 'live' : 'idle'} /></div>
      <div className="lg:hidden py-1"><Beam vertical state={s[3] === 'done' ? 'done' : s[3] === 'live' ? 'live' : 'idle'} /></div>

      <div className="rounded-md border border-dashed border-line p-3.5 text-center lg:w-32 lg:shrink-0">
        <div className="text-[11px] text-muted font-mono">OUTPUT</div>
        <div className="mt-1 text-2xl font-semibold">
          <NumberTicker value={total} />
        </div>
        <div className="text-[11px] text-muted">records</div>
      </div>
    </div>
  );
}

function Pages({ pages, maxPages }) {
  if (maxPages <= 1 && pages.length <= 1) return null;
  const rest = Math.max(0, maxPages - pages.length);
  return (
    <div className="mt-6 pt-5 border-t border-line grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
      {pages.map((p) => {
        let path = p.url;
        try {
          path = new URL(p.url).pathname + new URL(p.url).search;
        } catch {
          /* keep as is */
        }
        const live = p.status === 'running';
        return (
          <div key={p.n} className={`rounded-md px-3 py-2 flex items-center gap-2 text-xs ${live ? 'bg-accent2/10 border border-accent2/30' : 'bg-subtle/70'}`}>
            {live ? <span className="w-1.5 h-1.5 rounded-full bg-accent2 animate-pulse" /> : <span className="text-ok">✓</span>}
            <span className="font-mono truncate">{path || '/'}</span>
            <span className="ml-auto text-muted shrink-0 tabular-nums">
              {p.records} {live ? 'so far' : `records${p.seconds ? ` · ${p.seconds.toFixed(1)}s` : ''}`}
            </span>
          </div>
        );
      })}
      {rest > 0 && (
        <div className="rounded-md border border-dashed border-line px-3 py-2 flex items-center gap-2 text-xs text-faint">
          ○ {rest === 1 ? 'one more page' : `up to ${rest} more pages`} if there's a next link
        </div>
      )}
    </div>
  );
}

export function LogList({ logs, live }) {
  const listRef = useRef(null);
  const count = useRef(0);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const added = Array.from(el.children).slice(count.current);
    count.current = el.children.length;
    if (added.length && added.length < 10) fadeUp(added, { step: 30, distance: 4 });
    if (live) el.parentElement.scrollTop = el.parentElement.scrollHeight;
  }, [logs.length, live]);
  const time = (t) => {
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    return `${m}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  };
  return (
    <div ref={listRef} className="font-mono text-[12px] leading-6">
      {logs.map((l, i) => (
        <div key={i} className="flex gap-3">
          <span className="text-faint shrink-0 tabular-nums">{time(l.t)}</span>
          <span className={`w-11 shrink-0 ${LOG_COLOR[l.kind] || 'text-muted'}`}>{l.kind}</span>
          <span className="text-fg/90 break-words min-w-0">{l.msg}</span>
        </div>
      ))}
    </div>
  );
}

export default function RunView({ state, model, onStop }) {
  const { step, current, total, startedAt, pages, request, logs } = state;
  const ref = useReveal('run', { step: 90 });
  const where = [
    current.maxPages > 1 && `page ${current.page} of ${current.maxPages}`,
    current.parts && `part ${current.part} of ${current.parts}`,
  ].filter(Boolean).join(' · ');

  return (
    <section ref={ref} className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-16 flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted mb-1 inline-flex items-center gap-2" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-accent2 animate-pulse" />
            {STEP_LABEL[step] || 'Starting'}
            {where && ` · ${where}`}
          </div>
          <div className=" text-3xl sm:text-4xl font-semibold tracking-tight">
            <NumberTicker value={total} /> records <span className="text-muted font-normal text-xl">so far</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-muted">Elapsed</div>
            <LiveTimer startedAt={startedAt} className="text-lg" />
          </div>
          <button onClick={onStop} className="btn-outline !border-bad/40 !text-bad hover:!bg-bad/10">
            <Square size={13} fill="currentColor" /> Stop
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        <Flow state={state} model={model} />
        <Pages pages={pages} maxPages={request?.maxPages || 1} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line flex items-center gap-2 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-accent2 animate-pulse" /> Live log
          <span className="ml-auto font-mono">{logs.length} events</span>
        </div>
        <div className="p-4 max-h-64 overflow-auto">
          <LogList logs={logs} live />
        </div>
      </div>
    </section>
  );
}
