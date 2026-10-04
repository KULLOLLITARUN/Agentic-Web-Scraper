import React, { useEffect, useRef } from 'react';
import { motion } from '../lib/motion';

/** Counts up (or down) to `value` whenever it changes. */
export function NumberTicker({ value, decimals = 0, suffix = '', className = '' }) {
  const ref = useRef(null);
  const prev = useRef(0);
  const format = (v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  useEffect(() => {
    const target = Number(value) || 0;
    const counter = { v: prev.current };
    prev.current = target;
    const anim = motion(counter, {
      v: target,
      duration: 900,
      ease: 'outExpo',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = format(counter.v);
      },
    });
    return () => anim?.pause();
  }, [value, decimals, suffix]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(Number(value) || 0)}
    </span>
  );
}
