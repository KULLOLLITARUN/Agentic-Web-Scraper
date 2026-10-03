import React, { useEffect, useRef } from 'react';
import { Trash2, ChevronRight, Clock, Rows3 } from 'lucide-react';
import Modal from './Modal';
import { fadeUp } from '../lib/motion';

export default function HistoryModal({ isOpen, onClose, history = [], onSelectRun, onClearHistory }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) fadeUp(listRef.current?.children, { delay: 80, step: 35, distance: 6 });
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Run history"
      subtitle="Saved in this browser. Click a run to reload its results."
      width="max-w-xl"
      footer={
        <>
          <span className="text-xs text-muted">
            {history.length} {history.length === 1 ? 'run' : 'runs'}
          </span>
          {history.length > 0 && (
            <button onClick={onClearHistory} className="btn-ghost text-bad hover:text-bad hover:bg-bad/10">
              <Trash2 size={14} /> Clear all
            </button>
          )}
        </>
      }
    >
      {history.length === 0 ? (
        <div className="text-center py-14 text-sm text-muted">No runs yet.</div>
      ) : (
        <div ref={listRef} className="p-2">
          {history.map((run, i) => (
            <button
              key={run.id || i}
              onClick={() => {
                onSelectRun(run);
                onClose();
              }}
              className="w-full text-left px-3 py-3 rounded-lg hover:bg-subtle flex items-center gap-3 group transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{run.url.replace(/^https?:\/\//, '')}</div>
                <div className="text-xs text-muted truncate mt-0.5">{run.schema}</div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-faint">
                  <span className="flex items-center gap-1">
                    <Rows3 size={12} /> {run.itemsCount || 0} records
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {run.elapsed}s
                  </span>
                  <span>{run.timestamp}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-faint group-hover:text-fg group-hover:translate-x-0.5 transition" />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
