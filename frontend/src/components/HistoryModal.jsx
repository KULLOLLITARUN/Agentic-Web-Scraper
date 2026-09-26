import React from 'react';
import { X, Trash2, ArrowUpRight, Clock, Hash } from 'lucide-react';

export default function HistoryModal({
  isOpen,
  onClose,
  history = [],
  onSelectRun,
  onClearHistory
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-none flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#111215] border border-[#24262e] rounded-sharp shadow-2xl flex flex-col max-h-[80vh]">
        <div className="h-10 px-4 flex items-center justify-between border-b border-[#24262e] bg-[#0d0e11]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#f59e0b] rounded-sharp" />
            <span className="text-xs font-bold tracking-widest text-[#ededed] uppercase font-mono">
              EXTRACTION AUDIT RUNS
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-[#8a8f98] hover:text-[#ededed] p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
          {history.length === 0 ? (
            <div className="text-center py-10 text-[#525866]">
              No saved extraction sessions recorded yet.
            </div>
          ) : (
            history.map((run, i) => (
              <div 
                key={run.id || i}
                onClick={() => {
                  onSelectRun(run);
                  onClose();
                }}
                className="p-3 bg-[#16181d] border border-[#24262e] hover:border-[#f59e0b] rounded-sharp cursor-pointer group transition-all flex items-center justify-between gap-3"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#f59e0b] font-medium truncate max-w-sm">
                      {run.url}
                    </span>
                    <ArrowUpRight size={12} className="text-[#525866] group-hover:text-[#f59e0b] transition-colors" />
                  </div>
                  <div className="text-[10px] text-[#8a8f98] truncate">
                    {run.schema}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-[10px] text-[#525866]">
                  <span className="flex items-center gap-1 text-[#ededed]">
                    <Hash size={10} className="text-[#8a8f98]" />
                    {run.itemsCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {run.elapsed}s
                  </span>
                  <span>{run.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="h-10 px-4 border-t border-[#24262e] bg-[#0d0e11] flex items-center justify-between">
          <button
            onClick={onClearHistory}
            disabled={history.length === 0}
            className="text-[11px] font-mono text-[#8a8f98] hover:text-[#ef4444] flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Trash2 size={12} />
            CLEAR RUN HISTORY
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#16181d] hover:bg-[#24262e] border border-[#24262e] text-[#ededed] text-xs font-mono rounded-sharp transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
