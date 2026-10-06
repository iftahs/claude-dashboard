import { useEffect, useMemo, useState } from 'react';
import type { RouteIcon } from '@/routes';
import { useExport } from './useExport';
import { usePageExport } from './usePageActions';

export interface PaletteCommand {
  id: string;
  label: string;
  icon: RouteIcon;
  keywords?: string[];
  current?: boolean;
  onSelect: () => void;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export const PALETTE_SHORTCUT = IS_MAC ? '⌘ K' : 'Ctrl K';

const EXPORT_KEYWORDS = ['download', 'save', 'data'];

export function useCommandPalette(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  exportCommands: PaletteCommand[];
} {
  const [open, setOpen] = useState(false);
  const pageExport = usePageExport();
  const exportData = useExport();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key?.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Offered only while the page on screen has registered an export through useRegisterPageExport().
  const exportCommands = useMemo<PaletteCommand[]>(() => {
    if (!pageExport) return [];
    return [
      {
        id: 'export-csv',
        label: 'Export current view as CSV',
        icon: 'download',
        keywords: [...EXPORT_KEYWORDS, 'spreadsheet'],
        onSelect: () => exportData(pageExport, 'csv'),
      },
      {
        id: 'export-json',
        label: 'Export current view as JSON',
        icon: 'download',
        keywords: EXPORT_KEYWORDS,
        onSelect: () => exportData(pageExport, 'json'),
      },
    ];
  }, [pageExport, exportData]);

  return { open, setOpen, exportCommands };
}
