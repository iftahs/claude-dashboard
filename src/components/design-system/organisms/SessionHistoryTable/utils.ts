export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function getProjectName(path: string): string {
  if (!path) return 'unknown';
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
