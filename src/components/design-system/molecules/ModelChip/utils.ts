const UNSET_MODELS = new Set(['', 'inherit', 'unknown']);

export function isUnsetModel(model: string): boolean {
  return UNSET_MODELS.has(model);
}
