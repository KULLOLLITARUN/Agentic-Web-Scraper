import React, { useRef } from 'react';
import { History, Moon, Settings, Sun } from 'lucide-react';
import { motion } from '../lib/motion';
import { APP_NAME } from '../lib/brand';

export default function Header({ runNumber, onHome, onOpenHistory, historyCount, onOpenSettings, theme, onToggleTheme }) {
  const iconRef = useRef(null);
  const toggleTheme = () => {
    motion(iconRef.current, { rotate: [0, 180], scale: [0.6, 1], duration: 500, ease: 'outBack(1.6)' });
    onToggleTheme();
  };

  return (
    <header className="sticky top-0 z-30 h-[54px] md:h-[58px] flex items-center gap-3 md:gap-4 px-4 md:px-7 bg-bg border-b border-line">
      <button onClick={onHome} className="flex items-baseline font-bold text-base tracking-tight whitespace-nowrap" aria-label="Markpull: new scrape">
        <span className="marker font-serif italic font-normal text-[25px] leading-none">{APP_NAME.lead}</span>
        <span className="ml-[6px]">{APP_NAME.rest}</span>
      </button>
      {runNumber != null && (
        <span className="hidden sm:inline-block font-mono text-xs px-2 py-0.5 border border-line2 rounded text-muted">
          No. {String(runNumber).padStart(4, '0')}
        </span>
      )}
      <nav className="ml-auto flex items-center gap-0.5">
        <button onClick={onOpenHistory} className="btn-ghost" title="Past runs">
          <History size={17} />
          <span className="hidden md:inline">Runs</span>
          {historyCount > 0 && <span className="hidden md:inline font-mono text-xs text-faint">{historyCount}</span>}
        </button>
        <button onClick={toggleTheme} className="btn-ghost" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle theme">
          <span ref={iconRef} className="inline-flex">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</span>
          <span className="hidden md:inline">Theme</span>
        </button>
        <button onClick={onOpenSettings} className="btn-ghost" title="Settings">
          <Settings size={17} />
          <span className="hidden md:inline">Settings</span>
        </button>
      </nav>
    </header>
  );
}
