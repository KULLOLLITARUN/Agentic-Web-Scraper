import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Link2, FileCode, Sliders, Terminal } from 'lucide-react';

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
  headless = true,
  setHeadless,
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
    <div className="h-full flex flex-col bg-[#07080b] border-r-2 border-[#1c1e26] select-none text-[#ededed]">
      {/* Control Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b-2 border-[#1c1e26] bg-[#0c0e14]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#ff9e00]" />
          <span className="font-mono text-xs font-black tracking-widest text-white uppercase">
            CONTROL // PARAMETERS
          </span>
        </div>
        
        {/* Preset Pills */}
        <div className="flex items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setUrl(p.url);
                setSchema(p.schema);
              }}
              className="text-[9px] font-mono font-bold px-2 py-1 bg-[#141620] border border-[#222634] hover:border-[#ff9e00] hover:text-[#ff9e00] text-[#8890a4] transition-all active:translate-y-[1px]"
              title={`Load ${p.name} preset`}
            >
              [{p.name}]
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* TARGET URL CARD */}
        <div className="flex flex-col gap-1.5 bg-[#0b0d13] p-2.5 border border-[#1c1e26]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-black tracking-wider text-[#ff9e00] uppercase flex items-center gap-1.5">
              <Link2 size={12} className="text-[#ff9e00]" />
              TARGET_URL
            </label>
            {url && (
              <button 
                onClick={() => setUrl('')}
                className="text-[9px] font-mono font-bold text-[#555c70] hover:text-white transition-colors"
              >
                [CLEAR]
              </button>
            )}
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/target-data"
            className="w-full bg-[#12141c] border border-[#242838] focus:border-[#ff9e00] px-3 py-2 text-xs font-mono text-white placeholder-[#454c60] outline-none transition-all shadow-inner"
          />
        </div>

        {/* SCHEMA DEFINITION CARD */}
        <div className="flex flex-col gap-1.5 bg-[#0b0d13] p-2.5 border border-[#1c1e26]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-black tracking-wider text-[#ff9e00] uppercase flex items-center gap-1.5">
              <FileCode size={12} className="text-[#ff9e00]" />
              DATA_SCHEMA_SPECIFICATION
            </label>
            <span className="text-[9px] font-mono text-[#555c70] font-bold">PLAIN ENGLISH</span>
          </div>

          <div className="relative bg-[#12141c] border border-[#242838] focus-within:border-[#ff9e00] flex overflow-hidden transition-all shadow-inner">
            <div className="w-8 py-2 bg-[#0e1017] border-r border-[#242838] select-none text-[10px] font-mono text-[#454c60] font-bold text-right pr-2">
              {Array.from({ length: lineCount }).map((_, i) => (
                <div key={i} className="leading-5">{i + 1}</div>
              ))}
            </div>
            <textarea
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="Each item: title (string), price (float, no currency), in_stock (boolean)"
              className="flex-1 bg-transparent p-2 text-xs font-mono text-white placeholder-[#454c60] outline-none resize-none leading-5"
            />
          </div>
        </div>

        {/* DUAL PARAMETER CARDS */}
        <div className="grid grid-cols-2 gap-3">
          {/* RETRIES & ARRAY */}
          <div className="bg-[#0b0d13] p-2.5 border border-[#1c1e26] flex flex-col justify-between gap-2">
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[#788094] font-bold">RETRIES</span>
                <span className="text-[#ff9e00] font-black text-xs">{retries}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={retries}
                onChange={(e) => setRetries(parseInt(e.target.value, 10))}
                className="w-full accent-[#ff9e00] h-1.5 bg-[#1c1e26] cursor-pointer mt-1"
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#1c1e26] pt-2">
              <span className="text-[10px] font-mono text-[#788094] font-bold">EXPECT ARRAY</span>
              <button
                type="button"
                onClick={() => setExpectList(!expectList)}
                className={`px-2 py-0.5 font-mono text-[9px] font-black border transition-all ${
                  expectList 
                    ? 'bg-[#00ff88] text-black border-[#00ff88]' 
                    : 'bg-[#181a24] text-[#788094] border-[#252838]'
                }`}
              >
                {expectList ? 'YES' : 'NO'}
              </button>
            </div>
          </div>

          {/* BROWSER MODE & SCROLL */}
          <div className="bg-[#0b0d13] p-2.5 border border-[#1c1e26] flex flex-col justify-between gap-2">
            <div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[#788094] font-bold">SCROLL DEPTH</span>
                <span className="text-[#00ff88] font-black text-xs">{scroll ? `${maxScrolls}x` : 'OFF'}</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                disabled={!scroll}
                value={maxScrolls}
                onChange={(e) => setMaxScrolls(parseInt(e.target.value, 10))}
                className={`w-full h-1.5 bg-[#1c1e26] cursor-pointer mt-1 ${
                  scroll ? 'accent-[#00ff88]' : 'opacity-20 cursor-not-allowed'
                }`}
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#1c1e26] pt-2">
              <span className="text-[10px] font-mono text-[#788094] font-bold">BROWSER</span>
              <button
                type="button"
                onClick={() => setHeadless && setHeadless(!headless)}
                className={`px-2 py-0.5 font-mono text-[9px] font-black border transition-all ${
                  headless 
                    ? 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]' 
                    : 'bg-[#ff9e00]/20 text-[#ff9e00] border-[#ff9e00]'
                }`}
              >
                {headless ? 'HEADLESS' : 'VISIBLE'}
              </button>
            </div>
          </div>
        </div>

        {/* TACTILE 3D LAUNCH BUTTON (BASEMENT STUDIO STYLE) */}
        <button
          onClick={onRun}
          disabled={isLoading || !url || !schema}
          className={`w-full py-3 px-4 font-mono font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
            isLoading || !url || !schema
              ? 'bg-[#181a24] text-[#4d5366] border-2 border-[#242838] cursor-not-allowed'
              : 'bg-[#ff9e00] hover:bg-[#ffb020] text-black border-2 border-[#ffa81a] shadow-[0_4px_0_#b36b00] active:shadow-none active:translate-y-1'
          }`}
        >
          {isLoading ? (
            <>
              <RotateCcw size={15} className="animate-spin text-black" />
              <span>PIPELINE RUNNING...</span>
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" />
              <span>RUN EXTRACTION SEQUENCE</span>
              <span className="bg-black/25 text-black text-[10px] px-1.5 py-0.5 ml-1 border border-black/30 font-bold">
                Ctrl+Enter
              </span>
            </>
          )}
        </button>

        {/* AUDIT BUS FEED */}
        <div className="flex-1 flex flex-col min-h-[140px] bg-[#050608] border-2 border-[#1c1e26] overflow-hidden">
          <div className="h-7 px-3 bg-[#0d0e14] border-b border-[#1c1e26] flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#8890a4] font-black flex items-center gap-2">
              <span className="w-2 h-2 bg-[#00ff88]" />
              EXECUTION LOG BUS
            </span>
            <button 
              onClick={onClearLogs}
              className="text-[#555c70] hover:text-white font-bold transition-colors"
            >
              [CLEAR]
            </button>
          </div>

          <div className="flex-1 p-2.5 font-mono text-[10px] overflow-y-auto space-y-1.5 select-text">
            {logs.length === 0 ? (
              <div className="text-[#3d4252] italic p-1">
                Awaiting command dispatch...
              </div>
            ) : (
              logs.map((log, index) => {
                let badgeColor = 'bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/40';
                if (log.type === 'error') {
                  badgeColor = 'bg-[#ff3355]/20 text-[#ff3355] border-[#ff3355]/50';
                } else if (log.type === 'warn' || log.type === 'retry') {
                  badgeColor = 'bg-[#ff9e00]/20 text-[#ff9e00] border-[#ff9e00]/50';
                }

                return (
                  <div key={index} className="flex items-start gap-2 leading-tight">
                    <span className="text-[#454c60] shrink-0">{log.time}</span>
                    <span className={`px-1 py-0.2 border text-[9px] font-black shrink-0 ${badgeColor}`}>
                      [{log.badge || 'INFO'}]
                    </span>
                    <span className="text-[#d8dce8] break-all">{log.message}</span>
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
