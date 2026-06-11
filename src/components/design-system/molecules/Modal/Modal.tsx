import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ModalProps } from './types';

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal to body — ancestors with transform/backdrop-filter would otherwise
  // turn `fixed` into ancestor-relative positioning.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative card w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-white/10"
        style={{ animation: 'agent-enter 0.2s ease-out both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3 flex-none">
          <div className="min-w-0 flex-1">{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-none rounded-lg px-2 py-1 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors text-sm"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 min-h-0">{children}</div>
      </div>
    </div>,
    document.body
  );
}
