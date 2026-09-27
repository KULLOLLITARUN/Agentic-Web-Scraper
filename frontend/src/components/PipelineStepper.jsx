import React from 'react';
import { Globe, Scissors, Cpu, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

const STEPS = [
  { id: 'fetch', num: '01', label: 'FETCH_DOM', desc: 'Chromium Core' },
  { id: 'distill', num: '02', label: 'DISTILL', desc: 'DOM Pruning' },
  { id: 'infer', num: '03', label: 'INFERENCE', desc: 'Neural Pipeline' },
  { id: 'validate', num: '04', label: 'VALIDATE', desc: 'Schema Typing' }
];

export default function PipelineStepper({ currentStep, errorStep }) {
  const getStepStatus = (stepId, index) => {
    const stepOrder = ['fetch', 'distill', 'infer', 'validate'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const thisIndex = index;

    if (errorStep === stepId) return 'error';
    if (currentStep === 'done') return 'done';
    if (currentStep === 'idle') return 'pending';
    if (thisIndex < currentIndex) return 'done';
    if (thisIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full bg-[#07080b] border-b-2 border-[#1c1e26] p-2 sm:p-3 select-none">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id, index);

          let borderColor = 'border-[#1c1e26]';
          let bgColor = 'bg-[#0b0d13]';
          let textColor = 'text-[#505769]';
          let numBadge = 'bg-[#141620] text-[#555c70] border-[#1c1e26]';
          let pulseDot = 'bg-[#383d4d]';

          if (status === 'active') {
            borderColor = 'border-[#ff9e00] shadow-[0_0_12px_rgba(255,158,0,0.15)]';
            bgColor = 'bg-[#12110c]';
            textColor = 'text-white';
            numBadge = 'bg-[#ff9e00] text-black border-[#ffa81a] font-black';
            pulseDot = 'bg-[#ff9e00] animate-pulse';
          } else if (status === 'done') {
            borderColor = 'border-[#00ff88]/50';
            bgColor = 'bg-[#09120e]';
            textColor = 'text-white';
            numBadge = 'bg-[#00ff88] text-black border-[#00ff88] font-black';
            pulseDot = 'bg-[#00ff88]';
          } else if (status === 'error') {
            borderColor = 'border-[#ff3355] shadow-[0_0_12px_rgba(255,51,85,0.2)]';
            bgColor = 'bg-[#170a0d]';
            textColor = 'text-white';
            numBadge = 'bg-[#ff3355] text-white border-[#ff3355]';
            pulseDot = 'bg-[#ff3355]';
          }

          return (
            <div
              key={step.id}
              className={`p-2 sm:p-2.5 border-2 ${borderColor} ${bgColor} flex flex-col justify-between transition-all duration-200 relative overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                <span className={`px-1 sm:px-1.5 py-0.2 sm:py-0.5 border text-[9px] font-mono font-bold ${numBadge}`}>
                  {step.num}
                </span>
                <span className={`w-1.5 h-1.5 ${pulseDot}`} />
              </div>

              <div>
                <div className={`font-mono text-[10px] sm:text-[11px] font-black tracking-wider uppercase ${textColor}`}>
                  {step.label}
                </div>
                <div className="text-[9px] font-mono text-[#626a80] truncate mt-0.5">
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
