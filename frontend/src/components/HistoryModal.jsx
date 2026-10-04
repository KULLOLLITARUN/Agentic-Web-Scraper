import React, { useEffect, useRef, useState } from 'react';
import { Trash2, ChevronRight, Clock, Rows3, Play, X } from 'lucide-react';
import Modal from './Modal';
import { fadeUp } from '../lib/motion';

const host = (url) => url.replace(/^https?:\/\/(www\.)?/, '');

function SavedList({ saved, onRun, onEdit, onDelete }) {
  if (!saved.length) {
    return <div className="text-center py-14 px-6 text-sm text-muted">Nothing saved yet. Use “save request” under the form to keep one here.</div>;
  }
  return (
    <ul className="p-2 m-0 list-none">
      {saved.map((s) => (
        <li key={s.id} className="px-3 py-3 rounded-lg hover:bg-subtle flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{s.what || 'typed fields'}</div>
            <div className="font-mono text-[11px] text-faint truncate mt-0.5">{host(s.url)}</div>
          </div>
          <button onClick={() => onEdit(s)} className="btn-ghost text-xs">Edit</button>
          <button onClick={() => onRun(s)} className="btn-outline text-xs"><Play size={13} /> Run</button>
          <button onClick={() => onDelete(s.id)} aria-label={`Delete saved request ${s.what}`} className="w-7 h-7 grid place-items-center rounded text-faint hover:text-bad">
            <X size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function HistoryModal({ isOpen, onClose, history = [], onSelectRun, onClearHistory, saved = [], onRunSaved = () => {}, onEditSaved = () => {}, onDeleteSaved = () => {} }) {
  const listRef = useRef(null);
  const [tab, setTab] = useState('runs');

  useEffect(() => {
    if (isOpen) fadeUp(listRef.current?.children, { delay: 80, step: 35, distance: 6 });
  }, [isOpen, tab]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tab === 'runs' ? 'Run history' : 'Saved requests'}
      subtitle={tab === 'runs' ? 'Saved in this browser. Click a run to reload its results.' : 'Kept in this browser. Run one again in one click.'}
      width="max-w-xl"
      footer={
        <>
          <div role="tablist" className="inline-flex border border-line2 rounded-md overflow-hidden">
            {[['runs', `Runs ${history.length}`], ['saved', `Saved ${saved.length}`]].map(([id, text], i) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`px-3 py-1 text-xs ${i ? 'border-l border-line2' : ''} ${tab === id ? 'bg-fg text-bg' : 'bg-surface text-muted hover:text-fg'}`}>
                {text}
              </button>
            ))}
          </div>
          {tab === 'runs' && history.length > 0 && (
            <button onClick={onClearHistory} className="btn-ghost text-bad hover:text-bad hover:bg-bad/10">
              <Trash2 size={14} /> Clear all
            </button>
          )}
        </>
      }
    >
      {tab === 'saved' ? (
        <SavedList saved={saved} onRun={onRunSaved} onEdit={onEditSaved} onDelete={onDeleteSaved} />
      ) : history.length === 0 ? (
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
