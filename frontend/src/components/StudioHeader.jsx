import React from 'react';
import { Sun, Moon, Settings, History, Sparkles, Terminal } from 'lucide-react';

export default function StudioHeader({
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenHistory,
  historyCount = 0,
  status = 'idle'
}) {
  return (
    <header className="w-full border-b border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#08090b]/80 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-black text-sm tracking-tighter shadow-sm">
            ES
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-neutral-900 dark:text-white">
                EXTRACTOR
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                STUDIO v2.0
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              <span>Groq qwen3.8-27b</span>
              <span>•</span>
              <span>Playwright Headless</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Extraction Audit History"
          >
            <History size={14} />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-mono">
                {historyCount}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Configuration Settings"
          >
            <Settings size={15} />
          </button>

          {/* Sun / Moon Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-md text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun size={15} className="text-amber-400 transition-transform rotate-0 hover:rotate-45" />
            ) : (
              <Moon size={15} className="text-indigo-600 transition-transform rotate-0 hover:-rotate-12" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
