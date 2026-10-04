import React, { useEffect, useState } from 'react';
import Modal from './Modal';

const DEFAULTS = {
  apiKey: '',
  model: '',
  backendUrl: 'http://localhost:8001',
  maxChars: 40000,
};

// Keep in sync with MODELS in scraper/brain.py.
const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export default function SettingsModal({ isOpen, onClose, config = {}, onSave }) {
  const [form, setForm] = useState({ ...DEFAULTS, ...config });

  // Re-sync with the saved config every time the dialog opens.
  useEffect(() => {
    if (isOpen) setForm({ ...DEFAULTS, ...config });
  }, [isOpen, config]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const chars = Number.parseInt(form.maxChars, 10) || DEFAULTS.maxChars;
    onSave({ ...form, maxChars: Math.min(200000, Math.max(1000, chars)) });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      subtitle="Connection and model options."
      width="max-w-md"
      footer={
        <>
          <span />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancel
            </button>
            <button
              type="submit"
              form="settings-form"
              className="h-8 px-4 rounded-lg bg-accent text-accent-fg text-sm font-medium hover:brightness-110 transition"
            >
              Save
            </button>
          </div>
        </>
      }
    >
      <form id="settings-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        <Field label="Backend URL" hint="Where the FastAPI server is running.">
          <input className="field font-mono text-[13px]" value={form.backendUrl} onChange={set('backendUrl')} />
        </Field>
        <Field label="Model" hint="Tried first; the other models are used as fallbacks if it is rate-limited.">
          <select className="field" value={form.model} onChange={set('model')}>
            <option value="">Auto (gpt-oss-120b first)</option>
            {[...new Set([...MODELS, form.model].filter(Boolean))].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="API key" hint="Optional. Leave blank to use the server's .env key.">
          <input type="password" className="field" placeholder="••••••••" value={form.apiKey} onChange={set('apiKey')} />
        </Field>
        <Field label="Max page text (characters)" hint="Long pages are read in parts of 12,000 characters; text beyond this total is cut off. Higher catches more items on long pages but takes longer (the free Groq tier reads roughly 25,000 characters a minute).">
          <input type="number" min={1000} max={200000} step={1000} className="field" value={form.maxChars} onChange={set('maxChars')} />
        </Field>
      </form>
    </Modal>
  );
}
