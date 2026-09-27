import React from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export const PIPELINE_STEPS = [
  { id: 'fetch', num: '01', label: 'NAVIGATOR', desc: 'Chromium Engine' },
  { id: 'distill', num: '02', label: 'DISTILLER', desc: 'DOM Compression' },
  { id: 'infer', num: '03', label: 'INFERENCE', desc: 'Groq LPU LLM' },
  { id: 'validate', num: '04', label: 'VALIDATOR', desc: 'Self-Healing Gate' },
  { id: 'done', num: '05', label: 'DELIVERY', desc: 'Structured Payload' }
];

export default function PipelineStepper({ currentStep, errorStep }) {
  const getStepIndex = (stepId) => {
    return PIPELINE_STEPS.findIndex(s => s.id === stepId);
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="bg-[#0b0c10] border-b border-[#1f222d] px-4 py-2.5 select-none relative z-10">
      <div className="flex items-center justify-between relative">
        {/* Laser Pipeline Rail */}
        <div className="absolute top-3 left-6 right-6 h-[1px] bg-[#1a1c24] -z-0" />

        {PIPELINE_STEPS.map((step, idx) => {
          const isPassed = currentIndex > idx || currentStep === 'done';
          const isCurrent = currentIndex === idx && currentStep !== 'done';
          const isError = errorStep === step.id;

          let badgeStyle = 'bg-[#12131a] border-[#1f222d] text-[#555a68]';
          let labelColor = 'text-[#555a68]';
          let descColor = 'text-[#3e424f]';

          if (isError) {
            badgeStyle = 'bg-[#ff3355]/15 border-[#ff3355] text-[#ff3355] shadow-[0_0_10px_rgba(255,51,85,0.2)]';
            labelColor = 'text-[#ff3355] font-bold';
            descColor = 'text-[#ff3355]/80';
          } else if (isPassed) {
            badgeStyle = 'bg-[#10b981]/15 border-[#10b981] text-[#10b981]';
            labelColor = 'text-[#d8dce8] font-medium';
            descColor = 'text-[#6e7487]';
          } else if (isCurrent) {
            badgeStyle = 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.25)] led-pulse';
            labelColor = 'text-[#f59e0b] font-bold';
            descColor = 'text-[#f59e0b]/80';
          }

          return (
            <div key={step.id} className="flex flex-col items-center gap-1 relative z-10">
              <div 
                className={`h-5 min-w-[24px] px-1.5 rounded-[2px] border flex items-center justify-center font-mono text-[9px] font-bold transition-all duration-150 ${badgeStyle}`}
              >
                {isError ? (
                  <AlertCircle size={10} strokeWidth={2.5} />
                ) : isPassed ? (
                  <Check size={10} strokeWidth={3} />
                ) : isCurrent ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <span>{step.num}</span>
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-[10px] font-mono tracking-wider uppercase ${labelColor}`}>
                  {step.label}
                </span>
                <span className={`text-[8px] font-mono hidden md:block ${descColor}`}>
                  {step.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
