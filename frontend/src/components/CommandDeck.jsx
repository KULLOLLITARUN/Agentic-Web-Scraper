import React, { useState } from 'react';
import { Globe, Sparkles, Play, RotateCcw, ChevronDown, SlidersHorizontal, ArrowRight } from 'lucide-react';

const PRESETS = [
  {
    name: 'Quotes',
    url: 'https://quotes.toscrape.com',
    schema: 'Each quote: text (string), author (string), tags (list of strings)'
  },
  {
    name: 'Books',
    url: 'https://books.toscrape.com',
    schema: 'Each book: title (string), price (float, no currency symbol), rating (string), in_stock (boolean)'
  },
  {
    name: 'HackerNews',
    url: 'https://news.ycombinator.com',
    schema: 'Each story: rank (int), title (string), url (string), points (int or null), comments_count (int or null)'
  },
  {
    name: 'Naukri AI',
    url: 'https://www.naukri.com/ai-ml-engineer-jobs-in-bangalore?k=ai%20ml%20engineer&l=bangalore&nignbevent_src=jobsearchDeskGNB',
    schema: 'Each job: title (string), company (string), experience (string), salary (string), location (string), skills (list of strings)'
  }
];

export default function CommandDeck({
  url,
  setUrl,
  schema,
  setSchema,
  retries,
  setRetries,
  scroll,
  setScroll,
  maxScrolls,
  setMaxScrolls,
  headless,
  setHeadless,
  onRun,
  isLoading
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && url && schema) {
        onRun();
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6">
      {/* Spotlight Command Bar */}
      <div className="bg-white dark:bg-[#111216] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-studio-card p-3 sm:p-5 transition-all">
        
        {/* URL Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5 flex-1 px-2">
            <Globe size={18} className="text-neutral-400 shrink-0" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com/target-page"
              className="w-full bg-transparent text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 outline-none"
            />
          </div>

          {/* Action Button for Desktop */}
          <button
            onClick={onRun}
            disabled={isLoading || !url || !schema}
            className={`hidden sm:flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs tracking-wide transition-all ${
              isLoading || !url || !schema
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-95 shadow-sm'
            }`}
          >
            {isLoading ? (
              <>
                <RotateCcw size={14} className="animate-spin" />
                <span>Extracting...</span>
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" />
                <span>Extract</span>
                <span className="text-[10px] opacity-60 font-mono">⌘↵</span>
              </>
            )}
          </button>
        </div>

        {/* Schema Input */}
        <div className="pt-3 px-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
              <Sparkles size={12} className="text-indigo-500" />
              Target Extraction Schema
            </span>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              <SlidersHorizontal size={12} />
              <span>Options</span>
              <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <textarea
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Define fields in natural language (e.g., title, price, author, tags)"
            className="w-full bg-transparent text-xs font-mono text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Mobile Full-Width Action Button */}
        <div className="sm:hidden pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
          <button
            onClick={onRun}
            disabled={isLoading || !url || !schema}
            className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              isLoading || !url || !schema
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                : 'bg-black dark:bg-white text-white dark:text-black active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <RotateCcw size={15} className="animate-spin" />
                <span>Extracting Data...</span>
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                <span>Run Extraction</span>
              </>
            )}
          </button>
        </div>

        {/* Advanced Options Accordion */}
        {showAdvanced && (
          <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-sans">
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
              <span className="text-neutral-600 dark:text-neutral-400">Headless Mode</span>
              <button
                type="button"
                onClick={() => setHeadless(!headless)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                  headless
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}
              >
                {headless ? 'Headless' : 'Visible'}
              </button>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
              <span className="text-neutral-600 dark:text-neutral-400">Scroll Depth</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxScrolls}
                  onChange={(e) => setMaxScrolls(parseInt(e.target.value, 10))}
                  className="w-16 accent-neutral-900 dark:accent-white cursor-pointer"
                />
                <span className="font-mono text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 w-4">
                  {maxScrolls}x
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
              <span className="text-neutral-600 dark:text-neutral-400">Self-Healing Retries</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRetries(n)}
                    className={`w-6 h-6 rounded font-mono text-[11px] transition-colors ${
                      retries === n
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-black font-bold'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preset Pills */}
      <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-neutral-400 dark:text-neutral-500 text-[11px] font-medium shrink-0">
          Presets:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => {
              setUrl(p.url);
              setSchema(p.schema);
            }}
            className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800/60 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium shrink-0 transition-colors flex items-center gap-1"
          >
            <span>{p.name}</span>
            <ArrowRight size={10} className="opacity-40" />
          </button>
        ))}
      </div>
    </div>
  );
}
