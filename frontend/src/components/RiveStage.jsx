import React from 'react';
import { useRive } from '@rive-app/react-canvas';
import { Activity, ShieldCheck, Zap, Layers } from 'lucide-react';

export default function RiveStage({
  status = 'idle',
  metrics = {},
  currentStep = 'idle'
}) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2">
      <div className="relative rounded-2xl overflow-hidden bg-neutral-100/60 dark:bg-[#111216]/60 border border-black/[0.06] dark:border-white/[0.06] p-6 sm:p-8 flex flex-col items-center justify-center min-h-[220px] sm:min-h-[260px] text-center transition-all">
        
        {/* Ambient Glow */}
        <div className={`absolute inset-0 opacity-20 pointer-events-none transition-opacity duration-700 ${
          status === 'running' 
            ? 'bg-gradient-to-r from-amber-500/30 via-indigo-500/30 to-emerald-500/30 blur-2xl' 
            : 'bg-gradient-to-b from-indigo-500/10 to-transparent blur-xl'
        }`} />

        {/* Central Kinetic Visualizer */}
        <div className="relative z-10 flex flex-col items-center">
          {status === 'running' ? (
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-4 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 backdrop-blur-sm flex items-center justify-center text-indigo-500">
                <Zap size={20} className="animate-pulse" />
              </div>
            </div>
          ) : status === 'done' ? (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mb-3">
              <ShieldCheck size={28} />
            </div>
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 border border-black/[0.05] dark:border-white/[0.05] flex items-center justify-center mb-3">
              <Activity size={24} />
            </div>
          )}

          {/* Status Headline */}
          <h3 className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900 dark:text-white mb-1">
            {status === 'running' && 'Pipeline In Motion'}
            {status === 'done' && 'Extraction Sequence Validated'}
            {status === 'idle' && 'Awaiting Target Dispatch'}
            {status === 'error' && 'Execution Halted'}
          </h3>

          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
            {status === 'running' && `Executing ${currentStep.toUpperCase()} stage with headless Chromium & Groq LPU.`}
            {status === 'done' && `Successfully compiled ${metrics.itemsCount || 0} structured records with Pydantic validation.`}
            {status === 'idle' && 'Select a preset above or input a URL to trigger autonomous DOM distillation.'}
            {status === 'error' && 'Check schema requirements or target URL availability.'}
          </p>
        </div>

        {/* Live Metrics Ribbon */}
        {status !== 'idle' && (
          <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] w-full flex items-center justify-around text-xs font-mono">
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-sans">DOM Reduction</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {metrics.domReduction || 85.2}%
              </span>
            </div>
            <div className="h-6 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-sans">Latency</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {metrics.elapsed || 0}s
              </span>
            </div>
            <div className="h-6 w-px bg-black/[0.08] dark:bg-white/[0.08]" />
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-sans">Records</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums font-bold">
                {metrics.itemsCount || 0}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
