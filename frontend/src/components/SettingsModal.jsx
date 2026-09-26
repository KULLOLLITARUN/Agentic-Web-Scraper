import React from 'react';
import { X, Save, Key, Cpu, Server, FileText } from 'lucide-react';

const MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

export default function SettingsModal({
  isOpen,
  onClose,
  config,
  onSave
}) {
  const [apiKey, setApiKey] = React.useState(config.apiKey || '');
  const [model, setModel] = React.useState(config.model || 'qwen/qwen3.8-27b');
  const [backendUrl, setBackendUrl] = React.useState(config.backendUrl || 'http://localhost:8000');
  const [maxChars, setMaxChars] = React.useState(config.maxChars || 12000);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ apiKey, model, backendUrl, maxChars });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-none flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#111215] border border-[#24262e] rounded-sharp shadow-2xl flex flex-col font-mono text-xs">
        <div className="h-10 px-4 flex items-center justify-between border-b border-[#24262e] bg-[#0d0e11]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#f59e0b] rounded-sharp" />
            <span className="font-bold tracking-widest text-[#ededed] uppercase">
              WORKBENCH CONFIGURATION
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-[#8a8f98] hover:text-[#ededed] p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#8a8f98] uppercase flex items-center gap-1.5">
              <Key size={12} className="text-[#f59e0b]" />
              GROQ API KEY
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="bg-[#16181d] border border-[#24262e] focus:border-[#f59e0b] rounded-sharp px-3 py-2 text-xs text-[#ededed] placeholder-[#525866] outline-none"
            />
            <span className="text-[10px] text-[#525866]">Default is loaded from your server .env file</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#8a8f98] uppercase flex items-center gap-1.5">
              <Cpu size={12} className="text-[#f59e0b]" />
              LLM EXTRACTION ENGINE
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-[#16181d] border border-[#24262e] focus:border-[#f59e0b] rounded-sharp px-3 py-2 text-xs text-[#ededed] outline-none"
            >
              {MODELS.map((m) => (
                <option key={m} value={m} className="bg-[#111215] text-[#ededed]">
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#8a8f98] uppercase flex items-center gap-1.5">
              <Server size={12} className="text-[#f59e0b]" />
              FASTAPI BACKEND URL
            </label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="bg-[#16181d] border border-[#24262e] focus:border-[#f59e0b] rounded-sharp px-3 py-2 text-xs text-[#ededed] placeholder-[#525866] outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-[#8a8f98] uppercase flex items-center gap-1.5">
              <FileText size={12} className="text-[#f59e0b]" />
              DISTILLATION CHAR LIMIT
            </label>
            <input
              type="number"
              value={maxChars}
              onChange={(e) => setMaxChars(parseInt(e.target.value, 10))}
              className="bg-[#16181d] border border-[#24262e] focus:border-[#f59e0b] rounded-sharp px-3 py-2 text-xs text-[#ededed] outline-none"
            />
            <span className="text-[10px] text-[#525866]">Strips layout bloat beyond this character floor to conserve tokens</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#24262e]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-[#16181d] hover:bg-[#24262e] border border-[#24262e] text-[#ededed] rounded-sharp transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-black font-bold rounded-sharp transition-colors flex items-center gap-1.5"
            >
              <Save size={12} />
              SAVE PREFERENCES
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
