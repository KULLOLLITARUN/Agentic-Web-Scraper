import React, { useRef } from 'react';
import { History, Moon, Settings, Sun } from 'lucide-react';
import { motion } from '../lib/motion';
import { parseFields } from '../lib/schema';

function domain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function TopBar({ request, onEdit, onOpenHistory, historyCount, onOpenSettings, theme, onToggleTheme }) {
  const iconRef = useRef(null);
  const toggleTheme = () => {
    motion(iconRef.current, { rotate: [0, 180], scale: [0.6, 1], duration: 500, ease: 'outBack(1.6)' });
    onToggleTheme();
  };
  const parsed = request ? parseFields(request.schema) : null;
  const fieldNames = parsed ? parsed.fields.map((f) => f.name).join(', ') : request?.schema;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="max-w-[1400px] mx-auto h-14 px-4 sm:px-6 flex items-center gap-3 sm:gap-4">
        <button onClick={onEdit} className="flex items-center gap-2.5 shrink-0" aria-label="New scrape">
          <span className="w-3 h-3 bg-accent" aria-hidden="true" />
          <span className="font-semibold text-[15px] tracking-tight">web scraper</span>
          <span className="hidden sm:inline font-mono text-[11px] text-faint">v2</span>
        </button>

        {request ? (
          <>
          <div className="flex-1 sm:hidden" />
          <button onClick={onEdit} className="btn-ghost sm:hidden">
            Edit
          </button>
          <button
            onClick={onEdit}
            className="group hidden sm:flex flex-1 min-w-0 max-w-2xl mx-auto items-center gap-2 h-9 px-3 rounded-md border border-line bg-bg hover:border-fg/40 transition-colors text-left"
            title="Edit this request"
          >
            <span className="font-mono text-[11px] text-faint shrink-0">GET</span>
            <span className="font-mono text-[13px] truncate">{domain(request.url)}</span>
            <span className="hidden md:block text-faint">·</span>
            <span className="hidden md:block text-[13px] text-muted truncate">{fieldNames}</span>
            <span className="ml-auto text-xs text-muted group-hover:text-fg underline-offset-2 group-hover:underline shrink-0">edit</span>
          </button>
          </>
        ) : (
          <div className="flex-1" />
        )}

        <nav className="flex items-center gap-0.5 shrink-0">
          <button onClick={onOpenHistory} className="btn-ghost" title="Run history">
            <History size={17} />
            <span className="hidden md:inline">History</span>
            {historyCount > 0 && (
              <span className="text-[10px] min-w-[18px] px-1 rounded-full bg-accent/15 text-accent font-medium tabular-nums">{historyCount}</span>
            )}
          </button>
          <button onClick={toggleTheme} className="btn-ghost w-9 px-0" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle theme">
            <span ref={iconRef} className="inline-flex">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</span>
          </button>
          <button onClick={onOpenSettings} className="btn-ghost w-9 px-0" title="Settings" aria-label="Settings">
            <Settings size={17} />
          </button>
        </nav>
      </div>
    </header>
  );
}
