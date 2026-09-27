import React from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export const PIPELINE_STEPS = [
  { id: 'fetch', num: '01', label: 'NAVIGATOR', desc: 'Chromium Engine' },
  { id: 'distill', num: '02', label: 'DISTILLER', desc: '85% Compression' },
  { id: 'infer', num: '03', label: 'INFERENCE', desc: 'Neural Pipeline' },
  { id: 'validate', num: '04', label: 'VALIDATOR', desc: 'Self-Healing' },
  { id: 'done', num: '05', label: 'PAYLOAD', desc: 'Validated Data' }
];

export default function PipelineStepper({ currentStep, errorStep }) {
  const getStepIndex = (stepId) => {
    return PIPELINE_STEPS.findIndex(s => s.id === stepId);
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="bg-[#08090d] border-b-2 border-[#1c1e26] px-4 py-2.5 select-none">
      <div className="grid grid-cols-5 gap-2">
        {PIPELINE_STEPS.map((step, idx) => {
          const isPassed = currentIndex > idx || currentStep === 'done';
          const isCurrent = currentIndex === idx && currentStep !== 'done';
          const isError = errorStep === step.id;

          let cardStyle = 'bg-[#0d0e14] border-[#1c1e26] text-[#4d5366]';
          let numStyle = 'bg-[#141620] text-[#636c84] border-[#1c1e26]';
          let titleColor = 'text-[#636c84]';
          let descColor = 'text-[#3d4252]';

          if (isError) {
            cardStyle = 'bg-[#ff3355]/10 border-[#ff3355] text-[#ff3355] shadow-[0_0_15px_rgba(255,51,85,0.25)]';
            numStyle = 'bg-[#ff3355] text-black border-[#ff3355] font-black';
            titleColor = 'text-[#ff3355] font-black';
            descColor = 'text-[#ff3355]/90 font-mono';
          } else if (isPassed) {
            cardStyle = 'bg-[#00ff88]/10 border-[#00ff88]/60 text-white';
            numStyle = 'bg-[#00ff88] text-black border-[#00ff88] font-black';
            titleColor = 'text-white font-bold';
            descColor = 'text-[#8890a4] font-mono';
          } else if (isCurrent) {
            cardStyle = 'bg-[#ff9e00]/15 border-2 border-[#ff9e00] text-white shadow-[0_0_20px_rgba(255,158,0,0.3)] animate-pulse';
            numStyle = 'bg-[#ff9e00] text-black border-[#ff9e00] font-black';
            titleColor = 'text-[#ff9e00] font-black';
            descColor = 'text-white font-mono';
          }

          return (
            <div 
              key={step.id} 
              className={`p-2 border flex flex-col justify-between transition-all duration-200 ${cardStyle}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`w-5 h-5 flex items-center justify-center font-mono text-[10px] border ${numStyle}`}>
                  {isError ? (
                    <AlertCircle size={12} strokeWidth={3} />
                  ) : isPassed ? (
                    <Check size={12} strokeWidth={3.5} />
                  ) : isCurrent ? (
                    <Loader2 size={12} className="animate-spin text-black" />
                  ) : (
                    step.num
                  )}
                </span>
                <span className="font-mono text-[9px] text-[#4d5366] font-bold">STAGE</span>
              </div>
              <div>
                <div className={`font-mono text-[11px] tracking-wider leading-tight uppercase ${titleColor}`}>
                  {step.label}
                </div>
                <div className={`text-[9px] truncate ${descColor}`}>
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
