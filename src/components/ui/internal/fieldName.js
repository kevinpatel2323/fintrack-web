// What a form control is called, for the title of the bottom sheet its
// options open in on phones (Combobox, Select, DatePicker, DateRangePicker).

/** Visible text of an element, without the required-field asterisk. */
function textOf(el) {
  if (!el) return '';
  const copy = el.cloneNode(true);
  copy.querySelectorAll('[aria-hidden="true"], .sr-only').forEach((n) => n.remove());
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

const GENERIC = new Set(['', 'Select option', 'Select…', 'Select...', 'Select date', 'Select range']);

/**
 * In order: an explicit `title`; the `<label for>` of the control (what
 * FormControl renders); its `aria-labelledby`; its `title` attribute; its
 * `aria-label`; a specific placeholder; else `fallback`.
 */
export function fieldName(control, { title, ariaLabel, ariaLabelledBy, titleAttr, placeholder, fallback }) {
  if (title) return title;
  if (control && typeof document !== 'undefined') {
    const id = control.id;
    if (id) {
      const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
      const fromLabel = textOf(document.querySelector(`label[for="${escaped}"]`));
      if (fromLabel) return fromLabel;
    }
    const labelledBy = ariaLabelledBy ?? control.getAttribute?.('aria-labelledby');
    if (labelledBy) {
      const fromIds = labelledBy
        .split(/\s+/)
        .map((ref) => textOf(document.getElementById(ref)))
        .filter(Boolean)
        .join(' ');
      if (fromIds) return fromIds;
    }
  }
  if (titleAttr) return titleAttr;
  if (ariaLabel) return ariaLabel;
  if (placeholder && !GENERIC.has(placeholder)) return placeholder;
  return fallback;
}
