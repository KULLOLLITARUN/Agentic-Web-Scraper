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
    <header className="h-9 bg-[#0b0c10] border-b border-[#1f222d] px-3.5 flex items-center justify-between text-xs select-none relative z-20">
      {/* Left: Hardware Status Bus */}
      <div className="flex items-center gap-3">
        {/* System Heartbeat */}
        <div className="flex items-center gap-2 pr-2 border-r border-[#1f222d]">
          <span 
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isRunning ? 'bg-[#f59e0b] led-pulse' : 'bg-[#10b981]'
            }`} 
          />
          <span className="font-mono text-[11px] font-bold text-[#e6e8ee] tracking-wider uppercase">
            {isRunning ? 'EXEC_BUS_ACTIVE' : 'SYSTEM_READY'}
          </span>
          <span className="font-mono text-[10px] text-[#555a68] border border-[#1f222d] px-1 py-0.2 rounded-[2px]">
            v1.0.4
          </span>
        </div>

        {/* Telemetry Metric Readouts */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-[#8a90a0]">
          <div className="flex items-center gap-1.5">
            <span className="text-[#555a68]">DOM_REDUCE:</span>
            <span className="text-[#e6e8ee] font-medium tabular-nums">
              {metrics.domReduction ? `${metrics.domReduction}%` : '85.2%'}
            </span>
          </div>

          <div className="h-2.5 w-px bg-[#1f222d] hidden sm:block" />

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-[#555a68]">LATENCY:</span>
            <span className="text-[#e6e8ee] font-medium tabular-nums">
              {metrics.elapsed ? `${metrics.elapsed}s` : '1.92s'}
            </span>
          </div>

          <div className="h-2.5 w-px bg-[#1f222d] hidden md:block" />

          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-[#555a68]">CYCLE:</span>
            <span className="text-[#e6e8ee] font-medium tabular-nums">
              {metrics.attempt || 1}/{metrics.maxRetries || 3}
            </span>
          </div>

          <div className="h-2.5 w-px bg-[#1f222d] hidden lg:block" />

          <div className="hidden lg:flex items-center gap-1.5">
            <span className="text-[#555a68]">YIELD:</span>
            <span className="text-[#f59e0b] font-bold tabular-nums">
              {metrics.itemsCount || 0} ITEMS
            </span>
          </div>
        </div>
      </div>

      {/* Right: Action Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenHistory}
          className="h-6 px-2 rounded-[2px] border border-[#1f222d] hover:border-[#353a4b] hover:bg-[#14161f] text-[#8a90a0] hover:text-[#e6e8ee] flex items-center gap-1.5 transition-all text-[11px] font-mono"
          title="Execution Audit Log"
        >
          <History size={11} className="text-[#717789]" />
          <span>RUNS</span>
          {historyCount > 0 && (
            <span className="bg-[#1c1f2b] text-[#cbd0df] px-1 py-0.2 rounded-[2px] text-[9px] tabular-nums font-bold">
              {historyCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="h-6 w-6 rounded-[2px] border border-[#1f222d] hover:border-[#353a4b] hover:bg-[#14161f] text-[#8a90a0] hover:text-[#e6e8ee] flex items-center justify-center transition-all"
          title="Workbench Configuration"
        >
          <Settings size={12} />
        </button>
      </div>
    </header>
  );
}
