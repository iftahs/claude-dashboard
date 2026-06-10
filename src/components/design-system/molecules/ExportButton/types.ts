type ExportRow = Record<string, unknown>;

export interface ExportButtonProps {
  label?: string;
  getData: () => { csv: ExportRow[]; json: unknown; filename: string } | null;
}
