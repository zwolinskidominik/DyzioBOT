/**
 * Insert text at the current cursor / selection of a controlled input or textarea.
 * Pure helper (computeInsertion) is unit-testable; insertAtInputCursor wires it to the DOM.
 */

export interface InsertionResult {
  value: string;
  caret: number;
}

export function computeInsertion(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  text: string
): InsertionResult {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const next = value.slice(0, start) + text + value.slice(end);
  return { value: next, caret: start + text.length };
}

export function insertAtInputCursor(
  input: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
  currentValue: string,
  onChange: (next: string) => void
): void {
  if (!input) {
    onChange(currentValue + text);
    return;
  }
  const start = input.selectionStart ?? currentValue.length;
  const end = input.selectionEnd ?? currentValue.length;
  const { value: next, caret } = computeInsertion(currentValue, start, end, text);
  onChange(next);
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(caret, caret);
  });
}
