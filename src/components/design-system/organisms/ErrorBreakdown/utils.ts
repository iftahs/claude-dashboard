// Matches server/insights.ts classifyError; unknown keys fall back to the key with dashes as spaces.
const CATEGORY_LABELS: Record<string, string> = {
  'exit-code': 'Command failed',
  'patch-failed': 'Patch failed',
  'mcp-error': 'MCP error',
  'edit-mismatch': 'Edit mismatch',
  'not-read': 'Not read / stale',
  'file-not-found': 'File not found',
  'too-large': 'Too large',
  'usage-limit': 'Usage limit',
  blocked: 'Blocked',
  'invalid-input': 'Invalid input',
  'api-error': 'API error',
  network: 'Network',
  timeout: 'Timeout',
  other: 'Other',
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.replace(/-/g, ' ');
}

/** Error-rate text colour: red above 10%, amber above 5%. */
export function rateColor(rate: number): string {
  return rate > 0.1 ? 'text-red-400' : rate > 0.05 ? 'text-amber-400' : 'text-zinc-400';
}
