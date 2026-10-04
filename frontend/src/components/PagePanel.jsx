import React, { useEffect, useRef, useState } from 'react';
import { motion } from '../lib/motion';

const READING_STEPS = ['distill', 'infer', 'validate'];

function Scan({ viewport }) {
  const ref = useRef(null);
  useEffect(() => {
    const anim = motion(ref.current, {
      top: ['0%', '100%'],
      duration: 3600,
      ease: 'inOutSine',
      loop: true,
      alternate: true,
      onUpdate: () => {
        const el = ref.current;
        const vp = viewport.current;
        if (!el || !vp) return;
        // Keep the line in view while it reads.
        vp.scrollTop = Math.max(0, el.offsetTop - vp.clientHeight * 0.55);
      },
    });
    return () => anim?.pause();
  }, [viewport]);
  return (
    <div ref={ref} className="absolute inset-x-0 top-0 h-0.5 bg-pencil" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0.5 h-16 bg-gradient-to-t from-pencil/10 to-transparent" />
      <span className="absolute right-2 -top-[19px] px-1 rounded-sm bg-surface font-mono text-[10px] font-medium tracking-wide text-pencil">reading</span>
    </div>
  );
}

function Loading({ url }) {
  return (
    <div className="h-full min-h-[320px] grid place-items-center p-8 text-center">
      <div className="w-full max-w-sm space-y-3">
        <div className="font-mono text-xs text-muted truncate">opening {url}</div>
        {[80, 64, 72, 48].map((w, i) => (
          <div key={i} className="h-2.5 rounded bg-subtle animate-pulse mx-auto" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}

export default function PagePanel({ state }) {
  const { status, step, shots, pages, current, logs, request } = state;
  const viewport = useRef(null);
  const [shown, setShown] = useState(null); // page the user picked; null = follow the run
  const live = current.page || 1;
  const pageNo = shown ?? (status === 'running' ? live : Math.min(...Object.keys(shots).map(Number).concat(live)));
  const shot = shots[pageNo];
  const pageUrl = (pages.find((p) => p.n === pageNo) || {}).url || request?.url || '';
  const reading = status === 'running' && pageNo === live && READING_STEPS.includes(step);
  const ticker = logs.length ? logs[logs.length - 1].msg : '';

  useEffect(() => setShown(null), [request]);
  // Back to the top when switching pages or when reading stops.
  useEffect(() => {
    if (viewport.current && !reading) viewport.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageNo, reading]);

  if (!request) {
    return (
      <div className="min-h-[300px] md:min-h-[420px] grid place-items-center text-center p-8 border-[1.5px] border-dashed border-line2 rounded-md text-muted">
        <div>
          <div className="font-serif text-[28px] md:text-[34px] leading-tight text-fg mb-1.5">Paste a link above.</div>
          <p className="m-0">The page shows up here while it's read.</p>
        </div>
      </div>
    );
  }

  const tabs = Object.keys(shots).map(Number).sort((a, b) => a - b);
  return (
    <div className="bg-surface rounded shadow-[0_1px_0_rgba(20,33,61,.05),0_10px_28px_-14px_rgba(20,33,61,.3)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3 py-2 border-b border-line text-xs text-muted min-w-0">
        <span className="font-mono truncate min-w-0">{pageUrl}</span>
        {tabs.length > 1 && (
          <span className="ml-auto flex gap-0.5 shrink-0">
            {tabs.map((n) => (
              <button key={n} onClick={() => setShown(n)}
                className={`font-mono text-[11px] px-2 py-0.5 rounded-sm ${n === pageNo ? 'bg-fg text-bg' : 'text-faint hover:text-fg'}`}>
                p{n}
              </button>
            ))}
          </span>
        )}
      </div>
      <div ref={viewport} className={`relative overflow-auto overscroll-contain ${shot || status === 'running' ? 'h-[64vh] md:h-[calc(100vh-330px)] md:min-h-[440px]' : 'h-48'}`}>
        {shot ? (
          <div className="relative w-full" style={{ aspectRatio: `${shot.width} / ${shot.height}` }}>
            <img src={shot.image} alt={`The page as it was loaded (page ${pageNo})`} className="block w-full h-full dark:brightness-[.93]" />
            {reading && <Scan viewport={viewport} />}
          </div>
        ) : status === 'running' ? (
          <Loading url={pageUrl} />
        ) : (
          <div className="h-full grid place-items-center p-8 text-center text-sm text-muted">No picture of this page.</div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-line font-mono text-xs text-muted truncate" aria-live="polite">{ticker}</div>
    </div>
  );
}
