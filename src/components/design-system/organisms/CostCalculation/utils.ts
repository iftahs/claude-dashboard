export const CALCULATOR_LABEL = 'Cost calculator';
export const CALCULATOR_HINT = 'Price a hypothetical request at list rates. Pick a model here or select its row in the table.';
export const MODEL_LABEL = 'Model';
export const RESET_LABEL = 'Reset';
export const COST_LABEL = 'Est. cost';
export const PRICE_COLUMNS: readonly string[] = ['Input / 1M', 'Output / 1M', 'Cache write / 1M', 'Cache read / 1M'];

export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
