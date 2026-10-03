import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, popIn } from '../lib/motion';

export default function Modal({ isOpen, onClose, title, subtitle, children, footer, width = 'max-w-lg' }) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    motion(overlayRef.current, { opacity: [0, 1], duration: 200, ease: 'linear' });
    popIn(panelRef.current);
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div ref={panelRef} role="dialog" aria-modal="true" className={`w-full ${width} card shadow-pop flex flex-col max-h-[85vh]`}>
        <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-line">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost w-8 px-0 -mr-1.5" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex items-center justify-between gap-3">{footer}</div>}
      </div>
    </div>
  );
}
