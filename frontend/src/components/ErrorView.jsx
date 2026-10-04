import React, { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { motion } from '../lib/motion';
import { STEPS } from '../lib/useScrape';

const STEP_NAME = { fetch: 'Page', distill: 'Clean', infer: 'AI extract', validate: 'Check' };
const TITLE = {
  fetch: "The page couldn't be loaded",
  distill: "The page couldn't be read",
  infer: 'The model call failed',
  validate: "The output didn't match your fields",
};

function suggestions(step, message) {
  const m = message.toLowerCase();
  const tips = [];
  if (m.includes('/scrape/stream') || m.includes('failed to fetch') || m.includes('networkerror'))
    tips.push(['Is the backend running?', 'Start it with start.bat, or check the backend URL in Settings.']);
  if (m.includes('api key') || m.includes('401') || m.includes('authentication'))
    tips.push(['Check the Groq API key', 'Set GROQ_API_KEY in .env, or paste a key in Settings.']);
  if (m.includes('rate limit') || m.includes('429') || m.includes('tokens per'))
    tips.push(["Groq's free limit was hit", 'Wait a minute (or until tomorrow for the daily limit) and try again.']);
  if (step === 'fetch') {
    tips.push(['Check the link', 'Open it in your browser; the page may have moved or need a login.']);
    tips.push(['Site blocks bots?', 'Turn on “Show browser window” under More options.']);
  }
  if (step === 'validate' || m.includes('no items'))
    tips.push(['Adjust the fields', 'Use names and types that match what the page shows, e.g. price (float).']);
  if (!tips.length) tips.push(['Try again', 'Temporary errors often go away on a second run.']);
  return tips.slice(0, 4);
}

export default function ErrorView({ error, onRetry, onEdit }) {
  const ref = useRef(null);
  useEffect(() => {
    motion(ref.current, { translateX: [0, -8, 8, -4, 4, 0], duration: 450, ease: 'inOutSine' });
  }, [error]);
  if (!error) return null;
  const failed = STEPS.indexOf(error.step);

  return (
    <section className="max-w-[720px] mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16">
      <div ref={ref} className="card overflow-hidden">
        <div className="p-5 sm:p-6 space-y-2">
          <div className="font-mono text-xs text-bad">
            stopped at {STEP_NAME[error.step]?.toLowerCase()} · {error.elapsed.toFixed(1)}s
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{TITLE[error.step] || 'The scrape failed'}</h1>
          <p className="text-sm text-muted break-words">{error.message}</p>
        </div>

        <div className="px-5 sm:px-6 pb-5 flex items-center gap-2 text-[11px] font-mono overflow-x-auto">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="flex-1 min-w-[12px] h-px bg-line" />}
              <span
                className={`px-2 py-1 rounded-sm border whitespace-nowrap ${
                  i === failed ? 'border-bad/50 bg-bad/10 text-bad' : i < failed ? 'border-line text-muted' : 'border-line text-faint'
                }`}
              >
                {i < failed ? '✓ ' : i === failed ? '✕ ' : ''}
                {STEP_NAME[s].toLowerCase()}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-line bg-subtle/50 grid sm:grid-cols-2 gap-3 text-sm">
          {suggestions(error.step, error.message).map(([title, text]) => (
            <div key={title} className="rounded-md border border-line bg-surface p-3">
              <div className="font-medium">{title}</div>
              <div className="text-xs text-muted mt-0.5">{text}</div>
            </div>
          ))}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onEdit} className="btn-outline">
            Edit request
          </button>
          <button onClick={onRetry} className="btn-primary">
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      </div>
    </section>
  );
}
