import { useCallback } from 'react';
import { track } from '@/lib/analytics';
import { exportCsv, exportJson } from '@/lib/export';
import type { ExportFormat, ExportSource } from '@/lib/export';

export type ExportData = (getData: ExportSource, format: ExportFormat) => void;

export function useExport(): ExportData {
  return useCallback<ExportData>((getData, format) => {
    const result = getData();
    if (!result) return;
    // Filenames are static slugs ("trends-7d", "sessions"), never a path or a title.
    track('export_clicked', { chart: result.filename, format });
    if (format === 'csv') exportCsv(result.csv, `${result.filename}.csv`);
    else exportJson(result.json, `${result.filename}.json`);
  }, []);
}
