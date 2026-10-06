export const PAGE_ERROR_TITLE = 'This page hit an error';
export const APP_ERROR_TITLE = 'The dashboard hit an error';
export const RELOAD_HINT = 'Reloading usually fixes it, including after the dashboard was updated while this tab was open.';
export const RELOAD_LABEL = 'Reload page';

export function reloadPage() {
  window.location.reload();
}
