import { useState, useRef } from 'react';
import { exportCsv, exportJson } from '@/lib/export';
import { track } from '@/lib/analytics';
import type { ExportButtonProps } from './types';

export function ExportButton({ label = 'Export', getData }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleExport = (format: 'csv' | 'json') => {
    const result = getData();
    if (!result) return;
    setOpen(false);
    // filenames are static slugs (e.g. "trends-7d", "sessions") — no PII.
    track('export_clicked', { chart: result.filename, format });
    if (format === 'csv') exportCsv(result.csv, `${result.filename}.csv`);
    else exportJson(result.json, `${result.filename}.json`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200 hover:bg-ink-700/40 transition-colors"
        title={label}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 1v7M3 5.5l3 3 3-3M1 9.5v.5a1 1 0 001 1h8a1 1 0 001-1v-.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 min-w-[120px] rounded-xl border border-white/10 bg-ink-700 shadow-2xl py-1">
            <button
              onClick={() => handleExport('csv')}
              className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/5 transition-colors"
            >
              📄 Export CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/5 transition-colors"
            >
              {'{ }'} Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
