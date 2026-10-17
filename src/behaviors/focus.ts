/** Shared native focus contract. Geometry-free visibility checks also include
 * fixed-position controls, which offsetParent incorrectly excludes. */
export const FOCUSABLE = 'button, [href], input:not([type="hidden"]), select, textarea, icen-input, icen-select, icen-textarea, [tabindex], [contenteditable]:not([contenteditable="false"]), audio[controls], video[controls], details>summary';
/** Availability also applies to intentionally programmatic tabindex=-1 targets. */
export function isAvailableForFocus(el: HTMLElement): boolean {
  if(typeof document === 'undefined' || !el.isConnected || el.matches(':disabled,[disabled],[aria-disabled="true"]'))return false;
  if(el.closest('[hidden],[inert],[aria-hidden="true"]'))return false;
  const closed=el.closest('details:not([open])');
  if(closed && !closed.querySelector(':scope > summary')?.contains(el))return false;
  if(['hidden','collapse'].includes(getComputedStyle(el).visibility))return false;
  for(let ancestor: HTMLElement | null=el;ancestor;ancestor=ancestor.parentElement) {
    if(getComputedStyle(ancestor).display === 'none')return false;
  }
  return true;
}
export function focusableWithin(root: ParentNode): HTMLElement[] {
  if(typeof document === 'undefined')return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el)=>{
    return !(el.hasAttribute('tabindex') && el.tabIndex<0) && isAvailableForFocus(el);
  });
}
