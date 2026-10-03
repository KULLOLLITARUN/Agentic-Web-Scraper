import React, { useEffect, useState } from 'react';
import Modal from './Modal';

const DEFAULTS = {
  apiKey: '',
  model: 'qwen/qwen3.8-27b',
  backendUrl: 'http://localhost:8000',
  maxChars: 12000,
};

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
    onSave({ ...form, maxChars: parseInt(form.maxChars, 10) || DEFAULTS.maxChars });
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
        <Field label="Model">
          <input className="field font-mono text-[13px]" value={form.model} onChange={set('model')} />
        </Field>
        <Field label="API key" hint="Optional. Leave blank to use the server's .env key.">
          <input type="password" className="field" placeholder="••••••••" value={form.apiKey} onChange={set('apiKey')} />
        </Field>
        <Field label="Max page text (characters)">
          <input type="number" className="field" value={form.maxChars} onChange={set('maxChars')} />
        </Field>
      </form>
    </Modal>
  );
}
