export const CALCULATOR_LABEL = 'Cost calculator';
export const CALCULATOR_HINT = 'Price a hypothetical request at list rates. Pick a model here or select its row in the table.';
export const MODEL_LABEL = 'Model';
export const RESET_LABEL = 'Reset';
export const COST_LABEL = 'Est. cost';
export const PRICE_COLUMNS: readonly string[] = ['Input', 'Output', 'Cache write', 'Cache read'];
export const PRICE_UNIT = 'US dollars per 1M tokens';

export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
