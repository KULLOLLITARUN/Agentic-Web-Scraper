import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Link2, FileCode, Sliders, Terminal, ChevronRight } from 'lucide-react';

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
    <div className="h-full flex flex-col bg-[#07080b] border-r-0 lg:border-r-2 border-b-2 lg:border-b-0 border-[#1c1e26] select-none text-[#ededed]">
      {/* Control Header */}
      <div className="h-10 px-3 sm:px-4 flex items-center justify-between border-b-2 border-[#1c1e26] bg-[#0c0e14]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#ff9e00]" />
          <span className="font-mono text-xs font-black tracking-widest text-white uppercase">
            CONTROL // PARAMETERS
          </span>
        </div>
        
        {/* Preset Pills */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-none">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setUrl(p.url);
                setSchema(p.schema);
              }}
              className="text-[9px] font-mono font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#141620] border border-[#222634] hover:border-[#ff9e00] hover:text-[#ff9e00] text-[#8890a4] transition-all shrink-0 active:translate-y-[1px]"
              title={`Load ${p.name} preset`}
            >
              [{p.name}]
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
        {/* TARGET URL CARD */}
        <div className="flex flex-col gap-1.5 bg-[#0b0d13] p-2.5 sm:p-3 border border-[#1c1e26]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-black tracking-wider text-[#ff9e00] uppercase flex items-center gap-1.5">
              <Link2 size={12} className="text-[#ff9e00]" />
              TARGET_URL
            </label>
            {url && (
              <button 
                onClick={() => setUrl('')}
                className="text-[9px] font-mono text-[#555c70] hover:text-white uppercase transition-colors"
              >
                [CLEAR]
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-[#050608] border border-[#1c1e26] px-2.5 py-1.5 focus-within:border-[#ff9e00] transition-colors">
            <span className="text-[#00ff88] font-mono text-xs font-bold">»</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com/target-endpoint"
              className="w-full bg-transparent font-mono text-xs text-white placeholder-[#383d4d] outline-none"
            />
          </div>
        </div>

        {/* EXTRACTION CONTRACT (SCHEMA) */}
        <div className="flex flex-col gap-1.5 bg-[#0b0d13] p-2.5 sm:p-3 border border-[#1c1e26]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono font-black tracking-wider text-[#00ff88] uppercase flex items-center gap-1.5">
              <FileCode size={12} className="text-[#00ff88]" />
              SCHEMA_CONTRACT
            </label>
            <span className="text-[9px] font-mono text-[#555c70] font-bold">
              LINES: {lineCount}
            </span>
          </div>

          <div className="relative flex bg-[#050608] border border-[#1c1e26] focus-within:border-[#00ff88] transition-colors overflow-hidden">
            {/* Gutter Line Numbers */}
            <div className="w-7 bg-[#090a0f] border-r border-[#1c1e26] py-2 flex flex-col items-center select-none text-[10px] font-mono text-[#383d4d]">
              {Array.from({ length: Math.min(lineCount, 8) }).map((_, i) => (
                <span key={i} className="leading-5">{i + 1}</span>
              ))}
            </div>
            <textarea
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="Describe fields: text (string), author (string), tags (list of strings)"
              className="flex-1 bg-transparent p-2 font-mono text-xs text-white placeholder-[#383d4d] outline-none resize-none leading-5 select-text"
            />
          </div>
        </div>

        {/* HARDWARE RUNTIME PARAMETERS */}
        <div className="bg-[#0b0d13] p-2.5 sm:p-3 border border-[#1c1e26] flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-[#1c1e26] pb-1.5">
            <span className="text-[10px] font-mono font-black text-white flex items-center gap-1.5 uppercase">
              <Sliders size={12} className="text-[#ff9e00]" />
              RUNTIME BUS CONFIG
            </span>
            <span className="text-[9px] font-mono text-[#00ff88] font-bold">
              [STEALTH_ENGAGED]
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
            {/* RETRY CYCLES */}
            <div className="flex items-center justify-between bg-[#050608] p-2 border border-[#1c1e26]">
              <span className="text-[10px] font-mono text-[#788094] font-bold">RETRIES</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRetries(n)}
                    className={`w-5 h-5 font-mono text-[10px] font-bold border transition-all ${
                      retries === n 
                        ? 'bg-[#ff9e00] text-black border-[#ff9e00]' 
                        : 'bg-[#11131a] text-[#8890a4] border-[#1c1e26] hover:border-[#383e54]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* LIST TYPE */}
            <div className="flex items-center justify-between bg-[#050608] p-2 border border-[#1c1e26]">
              <span className="text-[10px] font-mono text-[#788094] font-bold">RETURN TYPE</span>
              <button
                type="button"
                onClick={() => setExpectList(!expectList)}
                className={`px-2 py-0.5 font-mono text-[9px] font-black border transition-all ${
                  expectList 
                    ? 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]' 
                    : 'bg-[#11131a] text-[#8890a4] border-[#1c1e26]'
                }`}
              >
                {expectList ? 'ARRAY[]' : 'OBJECT{}'}
              </button>
            </div>
          </div>

          {/* DYNAMIC SCROLL & HEADLESS */}
          <div className="bg-[#050608] p-2 sm:p-2.5 border border-[#1c1e26] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#788094] font-bold">DYNAMIC SCROLL</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScroll && setScroll(!scroll)}
                  className={`px-2 py-0.5 font-mono text-[9px] font-black border transition-all ${
                    scroll 
                      ? 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]' 
                      : 'bg-[#11131a] text-[#555c70] border-[#1c1e26]'
                  }`}
                >
                  {scroll ? 'ON' : 'OFF'}
                </button>
                <span className="text-[10px] font-mono text-white font-bold tabular-nums">
                  {maxScrolls}x
                </span>
              </div>
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
          className={`w-full py-3.5 px-4 font-mono font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
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
              <span className="hidden sm:inline-block bg-black/25 text-black text-[10px] px-1.5 py-0.5 ml-1 border border-black/30 font-bold">
                Ctrl+Enter
              </span>
            </>
          )}
        </button>

        {/* AUDIT BUS FEED */}
        <div className="flex-1 flex flex-col min-h-[130px] bg-[#050608] border-2 border-[#1c1e26] overflow-hidden">
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

          <div className="flex-1 p-2 sm:p-2.5 font-mono text-[10px] overflow-y-auto space-y-1.5 select-text max-h-[160px] lg:max-h-none">
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
                  <div key={index} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-[#555c70] shrink-0 font-bold text-[9px]">{log.time}</span>
                    <span className={`px-1 py-0.2 border text-[8px] font-bold uppercase shrink-0 ${badgeColor}`}>
                      {log.badge || 'INFO'}
                    </span>
                    <span className="text-[#c9ceda] break-all">{log.message}</span>
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
