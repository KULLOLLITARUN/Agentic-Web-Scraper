import React from 'react';
import { Settings, History, Sun, Moon } from 'lucide-react';

export default function StatusBar({ 
  status, 
  metrics, 
  onOpenSettings, 
  onOpenHistory,
  historyCount = 0,
  theme = 'dark',
  onToggleTheme
}) {
  const isRunning = status === 'running';

  return (
    <header className="h-12 bg-[#050608] dark:bg-[#050608] border-b-2 border-[#1c1e26] px-3 sm:px-4 flex items-center justify-between text-xs select-none sticky top-0 z-30 transition-colors">
      {/* Brand & Hardware Indicator */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-[#1c1e26]">
          <span 
            className={`w-2.5 h-2.5 rounded-none border border-black transition-colors ${
              isRunning ? 'bg-[#ff9e00] shadow-[0_0_8px_#ff9e00] animate-pulse' : 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]'
            }`} 
          />
          <span className="font-mono text-xs font-black text-white tracking-widest uppercase truncate max-w-[130px] sm:max-w-none">
            AGENTIC // WORKBENCH
          </span>
          <span className="hidden sm:inline-block bg-[#12141c] text-[#788094] border border-[#222634] font-mono text-[9px] font-bold px-1.5 py-0.5 tracking-wider">
            CHASSIS v1.4
          </span>
        </div>

        {/* Modular Hardware Metric Blocks */}
        <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-[11px]">
          <div className="bg-[#0b0d13] border border-[#1c1e26] px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1 sm:gap-1.5 text-[#8890a4]">
            <span className="text-[#505769] font-bold text-[8px] sm:text-[9px]">COMPR:</span>
            <span className="text-white font-bold tabular-nums">
              {metrics.domReduction ? `${metrics.domReduction}%` : '85.2%'}
            </span>
          </div>

          <div className="bg-[#0b0d13] border border-[#1c1e26] px-2 py-1 hidden sm:flex items-center gap-1.5 text-[#8890a4]">
            <span className="text-[#505769] font-bold text-[9px]">LATENCY:</span>
            <span className="text-white font-bold tabular-nums">
              {metrics.elapsed ? `${metrics.elapsed}s` : '0.00s'}
            </span>
          </div>

          <div className="bg-[#0b0d13] border border-[#1c1e26] px-2 py-1 hidden md:flex items-center gap-1.5 text-[#8890a4]">
            <span className="text-[#505769] font-bold text-[9px]">CYCLE:</span>
            <span className="text-white font-bold tabular-nums">
              {metrics.attempt || 1}/{metrics.maxRetries || 3}
            </span>
          </div>

          <div className="bg-[#0b0d13] border border-[#ff9e00]/30 px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1 sm:gap-1.5">
            <span className="text-[#ff9e00] font-bold text-[8px] sm:text-[9px]">YIELD:</span>
            <span className="text-[#ff9e00] font-black tabular-nums">
              {metrics.itemsCount || 0} <span className="hidden sm:inline">REC</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Hardware Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Sun / Moon Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="h-7 px-2 bg-[#11131a] hover:bg-[#181b24] border border-[#222634] hover:border-[#ff9e00] text-[#ff9e00] font-mono text-[10px] font-bold flex items-center justify-center transition-all shadow-sm active:translate-y-[1px]"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={12} className="text-[#ff9e00]" /> : <Moon size={12} className="text-[#00ff88]" />}
        </button>

        <button
          onClick={onOpenHistory}
          className="h-7 px-2 sm:px-3 bg-[#11131a] hover:bg-[#181b24] border border-[#222634] hover:border-[#383e54] text-white font-mono text-[10px] font-bold tracking-wider flex items-center gap-1 sm:gap-1.5 transition-all shadow-sm active:translate-y-[1px]"
          title="Audit Log Runs"
        >
          <History size={12} className="text-[#ff9e00]" />
          <span className="hidden sm:inline">AUDIT LOG</span>
          {historyCount > 0 && (
            <span className="bg-[#1f2330] text-[#00ff88] border border-[#2e3448] px-1 py-0.2 text-[9px] font-bold">
              {historyCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="h-7 w-7 bg-[#11131a] hover:bg-[#181b24] border border-[#222634] hover:border-[#383e54] text-[#8890a4] hover:text-white flex items-center justify-center transition-all shadow-sm active:translate-y-[1px]"
          title="Settings & Keys"
        >
          <Settings size={13} />
        </button>
      </div>
    </header>
  );
}
