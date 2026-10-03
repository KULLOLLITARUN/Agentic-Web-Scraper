import { animate, stagger } from 'animejs';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Thin wrapper around anime.js that skips animation for reduced-motion users.
export function motion(targets, params) {
  if (!targets || (Array.isArray(targets) && targets.length === 0)) return null;
  if (reducedMotion()) {
    return animate(targets, { ...params, duration: 0, delay: 0 });
  }
  return animate(targets, params);
}

export const fadeUp = (targets, { delay = 0, step = 40, distance = 10 } = {}) =>
  motion(targets, {
    opacity: [0, 1],
    translateY: [distance, 0],
    duration: 500,
    delay: stagger(step, { start: delay }),
    ease: 'outQuart',
  });

export const popIn = (targets) =>
  motion(targets, {
    opacity: [0, 1],
    scale: [0.96, 1],
    translateY: [8, 0],
    duration: 320,
    ease: 'outBack(1.4)',
  });

export { stagger };
