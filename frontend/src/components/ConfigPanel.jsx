import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Link2, FileCode } from 'lucide-react';

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
  }
];

export default function ConfigPanel({
  url,
  setUrl,
  schema,
  setSchema,
  retries,
  setRetries,
  expectList,
  setExpectList,
  scroll = true,
  setScroll,
  maxScrolls = 5,
  setMaxScrolls,
  onRun,
  isLoading,
  logs = [],
  onClearLogs
}) {
  const [lineCount, setLineCount] = useState(5);

  useEffect(() => {
    const lines = (schema || '').split('\n').length;
    setLineCount(Math.max(5, lines));
  }, [schema]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && url && schema) {
        onRun();
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#111215] border-r border-[#24262e] select-none">
      {/* Panel Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#24262e] bg-[#0d0e11]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#f59e0b] rounded-sharp" />
          <span className="text-xs font-bold tracking-widest text-[#ededed] uppercase">
            CONFIG & CONTROL
          </span>
        </div>
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setUrl(p.url);
                setSchema(p.schema);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded-sharp border border-[#24262e] hover:border-[#f59e0b] hover:text-[#f59e0b] text-[#8a8f98] transition-colors"
              title={`Load ${p.name} preset`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* TARGET URL */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold tracking-wider text-[#8a8f98] uppercase flex items-center gap-1.5">
              <Link2 size={12} className="text-[#f59e0b]" />
              TARGET URL
            </label>
            {url && (
              <button 
                onClick={() => setUrl('')}
                className="text-[10px] text-[#525866] hover:text-[#ededed]"
              >
                CLEAR
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com/data"
              className="w-full bg-[#16181d] border border-[#24262e] focus:border-[#f59e0b] rounded-sharp px-3 py-2 text-xs font-mono text-[#ededed] placeholder-[#525866] outline-none transition-colors"
            />
          </div>
        </div>

        {/* SCHEMA DEFINITION */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold tracking-wider text-[#8a8f98] uppercase flex items-center gap-1.5">
              <FileCode size={12} className="text-[#f59e0b]" />
              SCHEMA DEFINITION
            </label>
            <span className="text-[10px] text-[#525866]">PLAIN ENGLISH</span>
          </div>

          <div className="relative bg-[#16181d] border border-[#24262e] focus-within:border-[#f59e0b] rounded-sharp flex overflow-hidden transition-colors">
            <div className="w-8 py-2 bg-[#111215] border-r border-[#24262e] select-none text-[11px] font-mono text-[#525866] text-right pr-2">
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i} className="leading-5">{i + 1}</div>
              ))}
            </div>
            <textarea
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              placeholder="Each item: name (string), price (float, no currency), in_stock (boolean)"
              className="flex-1 bg-transparent p-2 text-xs font-mono text-[#ededed] placeholder-[#525866] outline-none resize-none leading-5"
            />
          </div>
        </div>

        {/* PARAMETERS ROW */}
        <div className="grid grid-cols-2 gap-3 p-2.5 bg-[#16181d] border border-[#24262e] rounded-sharp">
          {/* RETRIES */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-[#8a8f98]">MAX RETRIES</span>
              <span className="text-[#f59e0b] font-bold">{retries}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={retries}
              onChange={(e) => setRetries(parseInt(e.target.value, 10))}
              className="w-full accent-[#f59e0b] h-1 bg-[#24262e] rounded-sharp cursor-pointer"
            />
          </div>

          {/* EXPECT LIST */}
          <div className="flex items-center justify-between border-l border-[#24262e] pl-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#8a8f98]">EXPECT ARRAY</span>
              <span className="text-[9px] text-[#525866]">Return multiple items</span>
            </div>
            <button
              type="button"
              onClick={() => setExpectList(!expectList)}
              className={`w-9 h-5 rounded-sharp p-0.5 transition-colors border ${
                expectList 
                  ? 'bg-[#f59e0b] border-[#f59e0b]' 
                  : 'bg-[#111215] border-[#24262e]'
              }`}
            >
              <div 
                className={`w-3.5 h-3.5 bg-black rounded-sharp transition-transform ${
                  expectList ? 'translate-x-4' : 'translate-x-0 bg-[#525866]'
                }`} 
              />
            </button>
          </div>
        </div>

        {/* DYNAMIC SCROLL & STEALTH ROW */}
        <div className="grid grid-cols-2 gap-3 p-2.5 bg-[#16181d] border border-[#24262e] rounded-sharp">
          {/* AUTO-SCROLL TOGGLE */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#8a8f98]">AUTO-SCROLL</span>
              <span className="text-[9px] text-[#525866]">Infinite / lazy load</span>
            </div>
            <button
              type="button"
              onClick={() => setScroll(!scroll)}
              className={`w-9 h-5 rounded-sharp p-0.5 transition-colors border ${
                scroll 
                  ? 'bg-[#10b981] border-[#10b981]' 
                  : 'bg-[#111215] border-[#24262e]'
              }`}
            >
              <div 
                className={`w-3.5 h-3.5 bg-black rounded-sharp transition-transform ${
                  scroll ? 'translate-x-4' : 'translate-x-0 bg-[#525866]'
                }`} 
              />
            </button>
          </div>

          {/* SCROLL DEPTH */}
          <div className="flex flex-col gap-1 border-l border-[#24262e] pl-3">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-[#8a8f98]">SCROLL DEPTH</span>
              <span className="text-[#10b981] font-bold">{scroll ? `${maxScrolls}x` : 'OFF'}</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              disabled={!scroll}
              value={maxScrolls}
              onChange={(e) => setMaxScrolls(parseInt(e.target.value, 10))}
              className={`w-full h-1 bg-[#24262e] rounded-sharp cursor-pointer ${
                scroll ? 'accent-[#10b981]' : 'opacity-40 cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        {/* RUN BUTTON */}
        <button
          onClick={onRun}
          disabled={isLoading || !url || !schema}
          className={`w-full py-2.5 px-4 rounded-sharp font-mono font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all ${
            isLoading || !url || !schema
              ? 'bg-[#24262e] text-[#525866] cursor-not-allowed'
              : 'bg-[#f59e0b] hover:bg-[#d97706] text-black shadow-[0_0_15px_rgba(245,158,11,0.25)] active:translate-y-[1px]'
          }`}
        >
          {isLoading ? (
            <>
              <RotateCcw size={14} className="animate-spin text-black" />
              <span>RUNNING PIPELINE...</span>
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" />
              <span>RUN EXTRACTION</span>
              <span className="text-[10px] opacity-75 font-normal ml-1 border border-black/30 px-1 py-0.2 rounded-sharp">
                Ctrl+Enter
              </span>
            </>
          )}
        </button>

        {/* HEALTH & SELF-HEALING FEED */}
        <div className="flex-1 flex flex-col min-h-[160px] bg-[#0d0e11] border border-[#24262e] rounded-sharp overflow-hidden">
          <div className="h-7 px-3 bg-[#16181d] border-b border-[#24262e] flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#8a8f98] font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              SELF-HEALING FEED
            </span>
            <button 
              onClick={onClearLogs}
              className="text-[#525866] hover:text-[#ededed] text-[9px]"
            >
              CLEAR
            </button>
          </div>

          <div className="flex-1 p-2 font-mono text-[10px] overflow-y-auto space-y-1.5">
            {logs.length === 0 ? (
              <div className="text-[#525866] italic p-2">
                Waiting for extraction sequence to initialize...
              </div>
            ) : (
              logs.map((log, index) => {
                let badgeColor = 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40';
                if (log.type === 'error') {
                  badgeColor = 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40';
                } else if (log.type === 'warn' || log.type === 'retry') {
                  badgeColor = 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40';
                }

                return (
                  <div key={index} className="flex items-start gap-2 leading-tight">
                    <span className="text-[#525866] shrink-0">{log.time}</span>
                    <span className={`px-1 py-0.2 rounded-sharp border text-[9px] shrink-0 ${badgeColor}`}>
                      [{log.badge || 'INFO'}]
                    </span>
                    <span className="text-[#ededed] break-all">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
