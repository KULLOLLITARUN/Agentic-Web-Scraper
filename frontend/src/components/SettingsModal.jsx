import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  config = {},
  onSave
}) {
  const [formData, setFormData] = useState({
    apiKey: config.apiKey || '',
    model: config.model || 'qwen/qwen3.8-27b',
    backendUrl: config.backendUrl || 'http://localhost:8000',
    maxChars: config.maxChars || 12000
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#08090d] border-2 border-[#242838] shadow-[0_12px_40px_rgba(0,0,0,0.9)] flex flex-col">
        {/* Header */}
        <div className="h-10 px-4 flex items-center justify-between border-b-2 border-[#1c1e26] bg-[#0d0e14]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#00ff88]" />
            <span className="text-xs font-black tracking-widest text-white uppercase font-mono">
              SYSTEM // ENGINE CONFIG
            </span>
          </div>
          <button 
            onClick={onClose}
            className="text-[#788094] hover:text-white p-1 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 font-mono text-xs">
          <div>
            <label className="block text-[10px] font-black text-[#8890a4] mb-1 uppercase tracking-wider">
              API KEY (OPTIONAL OVERRIDE)
            </label>
            <input 
              type="password"
              placeholder="Defaults to server .env API key"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="w-full bg-[#0d0e14] border-2 border-[#1c1e26] focus:border-[#00ff88] text-white px-3 py-2 outline-none font-mono text-xs placeholder:text-[#3d4252]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#8890a4] mb-1 uppercase tracking-wider">
              AI ENGINE MODEL
            </label>
            <input 
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full bg-[#0d0e14] border-2 border-[#1c1e26] focus:border-[#00ff88] text-white px-3 py-2 outline-none font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#8890a4] mb-1 uppercase tracking-wider">
              FASTAPI BACKEND RPC
            </label>
            <input 
              type="text"
              value={formData.backendUrl}
              onChange={(e) => setFormData({ ...formData, backendUrl: e.target.value })}
              className="w-full bg-[#0d0e14] border-2 border-[#1c1e26] focus:border-[#00ff88] text-white px-3 py-2 outline-none font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-[#8890a4] mb-1 uppercase tracking-wider">
              MAX DISTILLED CONTEXT (CHARS)
            </label>
            <input 
              type="number"
              value={formData.maxChars}
              onChange={(e) => setFormData({ ...formData, maxChars: parseInt(e.target.value, 10) || 12000 })}
              className="w-full bg-[#0d0e14] border-2 border-[#1c1e26] focus:border-[#00ff88] text-white px-3 py-2 outline-none font-mono text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 font-mono text-xs font-bold text-[#8890a4] hover:text-white uppercase transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#00ff88] hover:bg-[#1aff96] text-black font-black font-mono text-xs uppercase flex items-center gap-1.5 shadow-[0_3px_0_#009952] active:translate-y-0.5 active:shadow-none transition-all"
            >
              <Check size={13} strokeWidth={3} />
              APPLY PARAMS
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
