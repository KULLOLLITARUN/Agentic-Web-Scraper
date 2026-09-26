import React from 'react';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export const PIPELINE_STEPS = [
  { id: 'fetch', label: 'FETCH', detail: 'Playwright headless browser' },
  { id: 'distill', label: 'DISTILL', detail: 'DOM noise & token compression' },
  { id: 'infer', label: 'INFER', detail: 'Groq LLaMA / Qwen reasoning' },
  { id: 'validate', label: 'VALIDATE', detail: 'Self-healing validation gate' },
  { id: 'done', label: 'DONE', detail: 'Structured delivery' }
];

export default function PipelineStepper({ currentStep, errorStep }) {
  const getStepIndex = (stepId) => {
    return PIPELINE_STEPS.findIndex(s => s.id === stepId);
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="bg-[#111215] border-b border-[#24262e] px-4 py-3 select-none">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-[11px] left-6 right-6 h-[1px] bg-[#24262e] -z-0" />

        {PIPELINE_STEPS.map((step, idx) => {
          const isPassed = currentIndex > idx || currentStep === 'done';
          const isCurrent = currentIndex === idx && currentStep !== 'done';
          const isError = errorStep === step.id;

          let nodeColor = 'bg-[#16181d] border-[#24262e] text-[#525866]';
          let textColor = 'text-[#525866]';

          if (isError) {
            nodeColor = 'bg-[#ef4444] border-[#ef4444] text-black';
            textColor = 'text-[#ef4444] font-semibold';
          } else if (isPassed) {
            nodeColor = 'bg-[#10b981] border-[#10b981] text-black';
            textColor = 'text-[#ededed] font-medium';
          } else if (isCurrent) {
            nodeColor = 'bg-[#f59e0b] border-[#f59e0b] text-black led-pulse';
            textColor = 'text-[#f59e0b] font-bold';
          }

          return (
            <div key={step.id} className="flex flex-col items-center gap-1.5 relative z-10">
              <div 
                className={`w-6 h-6 rounded-sharp border flex items-center justify-center text-[10px] font-mono transition-all duration-200 ${nodeColor}`}
              >
                {isError ? (
                  <AlertCircle size={12} strokeWidth={2.5} />
                ) : isPassed ? (
                  <Check size={12} strokeWidth={3} />
                ) : isCurrent ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span>0{idx + 1}</span>
                )}
              </div>
              <span className={`text-[10px] font-mono tracking-wider ${textColor}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
