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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-xl bg-[#08090d] border-2 border-[#242838] shadow-[0_12px_40px_rgba(0,0,0,0.9)] flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="h-10 px-4 flex items-center justify-between border-b-2 border-[#1c1e26] bg-[#0d0e14]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#ff9e00]" />
            <span className="text-xs font-black tracking-widest text-white uppercase font-mono">
              AUDIT // SESSION ARCHIVE
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-[#788094] hover:text-white p-1 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs select-text">
          {history.length === 0 ? (
            <div className="text-center py-12 text-[#4d5366]">
              NO HISTORICAL EXTRACTION LOGS FOUND.
            </div>
          ) : (
            history.map((run, i) => (
              <div 
                key={run.id || i}
                onClick={() => {
                  onSelectRun(run);
                  onClose();
                }}
                className="p-3 bg-[#0d0e14] border-2 border-[#1c1e26] hover:border-[#ff9e00] cursor-pointer group transition-all flex items-center justify-between gap-3 shadow-[0_2px_0_#14161f] active:translate-y-0.5"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#ff9e00] font-bold truncate max-w-sm">
                      {run.url}
                    </span>
                    <ArrowUpRight size={13} className="text-[#555c70] group-hover:text-[#ff9e00] transition-colors" />
                  </div>
                  <div className="text-[10px] text-[#788094] truncate">
                    {run.schema}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-[10px] text-[#555c70]">
                  <span className="flex items-center gap-1 text-white font-bold bg-[#141620] px-2 py-0.5 border border-[#242838]">
                    <Hash size={10} className="text-[#788094]" />
                    {run.itemsCount || 0}
                  </span>
                  <span className="flex items-center gap-1 text-[#8890a4]">
                    <Clock size={10} />
                    {run.elapsed}s
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="h-11 px-4 border-t-2 border-[#1c1e26] bg-[#0a0b10] flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#555c70] uppercase font-bold">
            TOTAL RECORDS: {history.length}
          </span>
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="text-[10px] font-mono font-bold text-[#ff3355] hover:text-white flex items-center gap-1.5 transition-colors uppercase"
            >
              <Trash2 size={11} />
              PURGE ARCHIVE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
