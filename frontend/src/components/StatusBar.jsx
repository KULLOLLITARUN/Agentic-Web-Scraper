import React from 'react';
import { Settings, History } from 'lucide-react';

export default function StatusBar({ 
  status, 
  metrics, 
  onOpenSettings, 
  onOpenHistory,
  historyCount = 0
}) {
  const isRunning = status === 'running';

  return (
    <header className="h-10 bg-[#0d0e11] border-b border-[#24262e] px-4 flex items-center justify-between text-xs select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#f59e0b] led-pulse' : 'bg-[#10b981]'}`} />
          <span className="font-bold text-[#ededed] tracking-wider uppercase">
            {isRunning ? 'PIPELINE ACTIVE' : 'SYSTEM READY'}
          </span>
          <span className="text-[#525866] font-normal">v1.0.4</span>
        </div>

        <div className="h-3 w-px bg-[#24262e]" />

        <div className="flex items-center gap-1.5 text-[#8a8f98]">
          <span className="text-[#525866]">DOM REDUCTION:</span>
          <span className="font-mono text-[#ededed] font-medium tabular-nums">
            {metrics.domReduction ? `${metrics.domReduction}%` : '85.2%'}
          </span>
        </div>

        <div className="h-3 w-px bg-[#24262e] hidden sm:block" />

        <div className="hidden sm:flex items-center gap-1.5 text-[#8a8f98]">
          <span className="text-[#525866]">LATENCY:</span>
          <span className="font-mono text-[#ededed] font-medium tabular-nums">
            {metrics.elapsed ? `${metrics.elapsed}s` : '1.92s'}
          </span>
        </div>

        <div className="h-3 w-px bg-[#24262e] hidden md:block" />

        <div className="hidden md:flex items-center gap-1.5 text-[#8a8f98]">
          <span className="text-[#525866]">RETRIES:</span>
          <span className="font-mono text-[#ededed] font-medium tabular-nums">
            {metrics.attempt || 1}/{metrics.maxRetries || 3}
          </span>
        </div>

        <div className="h-3 w-px bg-[#24262e] hidden lg:block" />

        <div className="hidden lg:flex items-center gap-1.5 text-[#8a8f98]">
          <span className="text-[#525866]">ITEMS:</span>
          <span className="font-mono text-[#f59e0b] font-medium tabular-nums">
            {metrics.itemsCount || 0}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenHistory}
          className="h-7 px-2.5 rounded-sharp border border-[#24262e] hover:border-[#3b404d] hover:bg-[#16181d] text-[#8a8f98] hover:text-[#ededed] flex items-center gap-1.5 transition-colors text-xs"
          title="Extraction History"
        >
          <History size={13} className="text-[#8a8f98]" />
          <span>RUNS</span>
          {historyCount > 0 && (
            <span className="bg-[#24262e] text-[#ededed] px-1 py-0.2 rounded-sharp text-[10px] tabular-nums">
              {historyCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="h-7 w-7 rounded-sharp border border-[#24262e] hover:border-[#3b404d] hover:bg-[#16181d] text-[#8a8f98] hover:text-[#ededed] flex items-center justify-center transition-colors"
          title="Configuration Settings"
        >
          <Settings size={13} />
        </button>
      </div>
    </header>
  );
}
