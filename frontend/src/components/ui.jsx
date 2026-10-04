import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { fadeUp, motion } from '../lib/motion';

/** Counts up (or down) to `value` whenever it changes. */
export function NumberTicker({ value, decimals = 0, suffix = '', className = '' }) {
  const ref = useRef(null);
  const prev = useRef(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const counter = { v: prev.current };
    prev.current = target;
    const anim = motion(counter, {
      v: target,
      duration: 900,
      ease: 'outExpo',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = counter.v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      },
    });
    return () => anim?.pause();
  }, [value, decimals, suffix]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix}
    </span>
  );
}

/** mm:ss.d since `startedAt` (a performance.now() value), updated 10x a second without re-rendering. */
export function LiveTimer({ startedAt, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const tick = () => {
      const s = (performance.now() - startedAt) / 1000;
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = (s % 60).toFixed(1).padStart(4, '0');
      if (ref.current) ref.current.textContent = `${mm}:${ss}`;
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span ref={ref} className={`font-mono tabular-nums ${className}`}>00:00.0</span>;
}

/**
 * The connector between two flow steps. `state`: idle | live | done.
 * A light pulse travels along it while live.
 */
export function Beam({ state = 'idle', vertical = false }) {
  const pulse = useRef(null);
  useEffect(() => {
    if (state !== 'live' || !pulse.current) return undefined;
    const anim = motion(pulse.current, {
      [vertical ? 'translateY' : 'translateX']: ['-100%', '250%'],
      duration: 1300,
      ease: 'inOutSine',
      loop: true,
    });
    return () => anim?.pause();
  }, [state, vertical]);

  const size = vertical ? 'w-0.5 h-8 mx-auto' : 'h-0.5 flex-1 min-w-[24px]';
  const base = state === 'done' ? 'bg-accent' : 'bg-line';
  return (
    <div className={`relative overflow-hidden rounded-full ${size} ${base}`} aria-hidden="true">
      {state === 'live' && (
        <span
          ref={pulse}
          className={`absolute ${vertical ? 'inset-x-0 h-1/2 bg-gradient-to-b' : 'inset-y-0 w-2/5 bg-gradient-to-r'} from-transparent via-accent2 to-transparent`}
        />
      )}
    </div>
  );
}

/** Fades and lifts a container's children in whenever `key` changes. */
export function useReveal(key, { step = 60, distance = 12 } = {}) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const children = ref.current ? Array.from(ref.current.children) : [];
    if (children.length) fadeUp(children, { step, distance });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

/** A small round status mark for a flow step. */
export function StepMark({ state }) {
  if (state === 'done')
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-ok">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  if (state === 'live')
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent2 animate-spin">
        <path d="M21 12a9 9 0 1 1-6.2-8.6" />
      </svg>
    );
  if (state === 'error')
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-bad">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  return <span className="w-2 h-2 rounded-full bg-line" />;
}
