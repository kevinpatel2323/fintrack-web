import { useEffect, useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog, ErrorMessage, FormControl, FormLabel } from '../ui';
import { CategoryIcon } from '../common/Category.jsx';
import { CATEGORY_PALETTE, categoryColor } from '../../utils/categoryColors.js';
import { useIsCompact } from '../../styles/breakpoints.js';
import './category-dialogs.css';

const PRESET_COLORS = Object.values(CATEGORY_PALETTE);
const DEFAULT_COLOR = PRESET_COLORS[0];

// Names for the palette swatches (screen readers, tooltips). Keyed by the
// palette key so a new palette entry still gets a readable fallback.
const COLOR_NAMES = {
  food: 'Orange',
  transport: 'Blue',
  shopping: 'Violet',
  bills: 'Amber',
  grocery: 'Green',
  rent: 'Pink',
  entmt: 'Purple',
  transfer: 'Gray',
  salary: 'Teal',
  health: 'Cyan',
  red: 'Red',
  yellow: 'Yellow',
};

const PALETTE_SWATCHES = Object.entries(CATEGORY_PALETTE).map(([key, hex]) => ({
  value: hex,
  label: COLOR_NAMES[key] || key,
}));

function sameColor(a, b) {
  return String(a || '').toUpperCase() === String(b || '').toUpperCase();
}

/**
 * Round colour buttons from CATEGORY_PALETTE, as a radio group. The stored
 * value is the palette hex; the swatch draws its theme token. A colour saved
 * before the current palette shows as an extra "Current colour" swatch so it
 * stays visible and selected until the user picks another.
 */
function ColorSwatches({ value, onChange, labelId }) {
  const refs = useRef([]);
  const custom = value && !PALETTE_SWATCHES.some((s) => sameColor(s.value, value));
  const swatches = custom ? [{ value, label: 'Current colour' }, ...PALETTE_SWATCHES] : PALETTE_SWATCHES;
  const selectedIndex = swatches.findIndex((s) => sameColor(s.value, value));
  const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

  function move(from, step) {
    const next = (from + step + swatches.length) % swatches.length;
    onChange(swatches[next].value);
    refs.current[next]?.focus();
  }

  function onKeyDown(event, index) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    }
  }

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="catg-swatches">
      {swatches.map((s, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={s.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={s.label}
            title={s.label}
            tabIndex={i === focusIndex ? 0 : -1}
            className="catg-swatch"
            style={{ '--catg-swatch': categoryColor({ color: s.value }) }}
            onClick={() => onChange(s.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {selected && <Check size={14} strokeWidth={2.5} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Create or edit a category: name, icon (emoji or short text) and colour.
 * `onSubmit({ name, color, icon })` saves; a rejection shows its message here.
 */
export default function CategoryFormDialog({ open, category, onClose, onSubmit }) {
  // Phones: the sheet takes focus rather than the name field, so the keyboard
  // doesn't cover the colours (frappe-ui BottomSheet); fields are 44px.
  const isMobile = useIsCompact();
  const fieldSize = isMobile ? 'lg' : undefined;
  const formId = useId();
  const colorLabelId = useId();
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [icon, setIcon] = useState('');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name || '');
    setColor(category?.color || DEFAULT_COLOR);
    setIcon(category?.icon || '');
    setNameError('');
    setError('');
    setSubmitting(false);
  }, [open, category]);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ name: trimmed, color, icon });
    } catch (err) {
      setError(err?.message || 'Save failed');
      setSubmitting(false);
    }
  }

  const isEdit = Boolean(category);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={isEdit ? 'Edit category' : 'New category'}
      actions={[
        { label: 'Cancel', disabled: submitting },
        {
          label: isEdit ? 'Save' : 'Add category',
          variant: 'solid',
          type: 'submit',
          form: formId,
          loading: submitting,
        },
      ]}
    >
      <form id={formId} className="catg-form" onSubmit={submit} noValidate>
        <FormControl
          label="Name"
          required
          autoFocus={!isMobile}
          size={fieldSize}
          maxLength={100}
          placeholder="e.g. Coffee"
          value={name}
          error={nameError}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError('');
          }}
        />

        <div className="catg-form__icon-row">
          <FormControl
            className="catg-form__icon-field"
            label="Icon"
            description="An emoji or up to 6 characters. Leave empty for the default icon."
            placeholder="Optional"
            size={fieldSize}
            maxLength={6}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
          <span className="catg-form__preview" title="Preview">
            <CategoryIcon category={{ name: name || 'Category', color, icon }} size={isMobile ? 44 : 28} />
          </span>
        </div>

        <div className="catg-form__field">
          <FormLabel as="div" labelId={colorLabelId} label="Colour" />
          <ColorSwatches value={color} onChange={setColor} labelId={colorLabelId} />
        </div>

        <ErrorMessage message={error} />
      </form>
    </Dialog>
  );
}
