import React, { useEffect, useRef } from 'react';
import { Globe, Scissors, Sparkles, ShieldCheck, Check, X } from 'lucide-react';
import { utils } from 'animejs';
import { motion } from '../lib/motion';

const STEPS = [
  { id: 'fetch', label: 'Fetch page', desc: 'Load in Chromium', Icon: Globe },
  { id: 'distill', label: 'Clean HTML', desc: 'Strip noise', Icon: Scissors },
  { id: 'infer', label: 'Extract', desc: 'Map to your fields', Icon: Sparkles },
  { id: 'validate', label: 'Validate', desc: 'Check the schema', Icon: ShieldCheck },
];
const ORDER = STEPS.map((s) => s.id);

function stepStatus(stepId, index, currentStep, errorStep) {
  if (errorStep === stepId) return 'error';
  if (errorStep && index > ORDER.indexOf(errorStep)) return 'pending';
  if (currentStep === 'done') return 'done';
  if (currentStep === 'idle') return 'pending';
  const current = ORDER.indexOf(currentStep);
  if (index < current) return 'done';
  if (index === current) return 'active';
  return 'pending';
}

export default function PipelineStepper({ currentStep, errorStep, attempt, pageInfo, partInfo }) {
  const barRef = useRef(null);
  const nodeRefs = useRef([]);

  const reached = errorStep
    ? ORDER.indexOf(errorStep)
    : currentStep === 'done'
      ? ORDER.length - 1
      : Math.max(0, ORDER.indexOf(currentStep));
  const progress = currentStep === 'idle' && !errorStep ? 0 : reached / (ORDER.length - 1);

  useEffect(() => {
    utils.set(barRef.current, { scaleX: 0 });
  }, []);

  useEffect(() => {
    motion(barRef.current, { scaleX: progress, duration: 700, ease: 'outExpo' });
  }, [progress]);

  useEffect(() => {
    const idx = errorStep ? ORDER.indexOf(errorStep) : ORDER.indexOf(currentStep);
    const node = nodeRefs.current[idx];
    if (node) motion(node, { scale: [0.7, 1], duration: 600, ease: 'outElastic(1, .6)' });
  }, [currentStep, errorStep]);

  return (
    <div className="px-4 sm:px-6 pt-5 pb-4">
      <div className="relative grid grid-cols-4">
        {/* track */}
        <div className="absolute top-[18px] left-[12.5%] right-[12.5%] h-0.5 rounded-full bg-line" />
        <div
          ref={barRef}
          className={`absolute top-[18px] left-[12.5%] right-[12.5%] h-0.5 rounded-full origin-left ${errorStep ? 'bg-bad' : 'bg-accent'}`}
        />

        {STEPS.map(({ id, label, desc, Icon }, i) => {
          const st = stepStatus(id, i, currentStep, errorStep);
          // Surface self-healing retries on the LLM steps.
          const retrying = attempt && attempt.current > 1 && (id === 'infer' || id === 'validate') && st !== 'pending';
          const paging = pageInfo && id === 'fetch';
          // Long pages are read in parts.
          const parting = partInfo && id === 'infer' && st !== 'pending';
          let detail = desc;
          if (retrying) detail = `Attempt ${attempt.current} of ${attempt.max}`;
          else if (parting) detail = `Part ${partInfo.part} of ${partInfo.parts}`;
          else if (paging) detail = `Page ${pageInfo.page} of up to ${pageInfo.max}`;
          const node = {
            pending: 'bg-surface border-line text-faint',
            active: 'bg-accent border-accent text-accent-fg ring-4 ring-accent/20',
            done: 'bg-accent/10 border-accent/40 text-accent',
            error: 'bg-bad border-bad text-white ring-4 ring-bad/20',
          }[st];

          return (
            <div key={id} className="relative flex flex-col items-center text-center gap-2 min-w-0">
              <div
                ref={(el) => (nodeRefs.current[i] = el)}
                className={`relative z-10 w-9 h-9 rounded-full border-2 grid place-items-center transition-colors duration-300 ${node}`}
              >
                {st === 'done' ? <Check size={16} strokeWidth={2.5} /> : st === 'error' ? <X size={16} strokeWidth={2.5} /> : <Icon size={16} />}
                {st === 'active' && <span className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-40" />}
              </div>
              <div className="min-w-0 px-1">
                <div className={`text-xs sm:text-sm font-medium truncate ${st === 'pending' ? 'text-muted' : 'text-fg'}`}>{label}</div>
                <div className={`text-[11px] truncate hidden sm:block ${retrying ? 'text-warn' : paging ? 'text-accent' : 'text-faint'}`}>{detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
