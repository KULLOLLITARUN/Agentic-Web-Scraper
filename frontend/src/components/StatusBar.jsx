import React, { useEffect, useRef } from 'react';
import { Settings, History, Sun, Moon, ScanSearch } from 'lucide-react';
import { motion } from '../lib/motion';

const STATUS = {
  idle: { label: 'Ready', dot: 'bg-faint', text: 'text-muted' },
  running: { label: 'Running', dot: 'bg-warn', text: 'text-warn' },
  done: { label: 'Completed', dot: 'bg-ok', text: 'text-ok' },
  error: { label: 'Failed', dot: 'bg-bad', text: 'text-bad' },
};

function CountUp({ value, decimals = 0, suffix = '', from = 0 }) {
  const ref = useRef(null);
  const prev = useRef(from);

  useEffect(() => {
    const target = Number(value) || 0;
    const counter = { v: prev.current };
    prev.current = target;
    const anim = motion(counter, {
      v: target,
      duration: 700,
      ease: 'outExpo',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = counter.v.toFixed(decimals) + suffix;
      },
    });
    return () => anim?.pause();
  }, [value, decimals, suffix]);

  return <span ref={ref} className="tabular-nums">{(Number(value) || 0).toFixed(decimals) + suffix}</span>;
}

// Ticks the time since *startedAt* (a performance.now() value) while a scrape
// runs. Writes to the DOM directly so the header doesn't re-render 10x a second.
function LiveTimer({ startedAt, lastRef }) {
  const ref = useRef(null);

  useEffect(() => {
    const tick = () => {
      const seconds = (performance.now() - startedAt) / 1000;
      lastRef.current = seconds;
      if (ref.current) ref.current.textContent = seconds.toFixed(1) + 's';
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt, lastRef]);

  return <span ref={ref} className="tabular-nums">0.0s</span>;
}

export default function StatusBar({
  status,
  metrics,
  startedAt = null,
  onOpenSettings,
  onOpenHistory,
  historyCount = 0,
  theme = 'dark',
  onToggleTheme,
}) {
  const s = STATUS[status] || STATUS.idle;
  const iconRef = useRef(null);
  // Last live timer value, so the final time animates on from where it stopped.
  const lastLive = useRef(0);

  const handleTheme = () => {
    motion(iconRef.current, { rotate: [0, 180], scale: [0.6, 1], duration: 500, ease: 'outBack(1.6)' });
    onToggleTheme();
  };

  return (
    <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-line bg-surface/80 backdrop-blur-md">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-accent text-accent-fg grid place-items-center shrink-0">
          <ScanSearch size={17} strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">Web Scraper</div>
          <div className="text-xs text-muted leading-tight truncate hidden sm:block">Describe the data, get structured JSON</div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1 rounded-full border border-line bg-subtle/60 p-1 text-xs">
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface font-medium ${s.text}`}>
          <span className={`relative w-1.5 h-1.5 rounded-full ${s.dot}`}>
            {status === 'running' && <span className={`absolute inset-0 rounded-full ${s.dot} animate-ping`} />}
          </span>
          {s.label}
        </span>
        <span className="px-2.5 text-muted">
          <span className="text-fg font-medium"><CountUp value={metrics.itemsCount} /></span> records
        </span>
        <span className="px-2.5 text-muted border-l border-line">
          <span className="text-fg font-medium">
            {startedAt != null ? (
              <LiveTimer startedAt={startedAt} lastRef={lastLive} />
            ) : (
              <CountUp value={metrics.elapsed} decimals={2} suffix="s" from={lastLive.current} />
            )}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleTheme}
          className="btn-ghost w-9 px-0"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          <span ref={iconRef} className="inline-flex">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </span>
        </button>
        <button onClick={onOpenHistory} className="btn-ghost" title="Run history">
          <History size={17} />
          <span className="hidden sm:inline">History</span>
          {historyCount > 0 && (
            <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-accent/15 text-accent text-[11px] font-semibold grid place-items-center">
              {historyCount}
            </span>
          )}
        </button>
        <button onClick={onOpenSettings} className="btn-ghost w-9 px-0" title="Settings" aria-label="Settings">
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
