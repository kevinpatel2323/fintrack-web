import { Check } from 'lucide-react';

/**
 * Numbered steps of the import flow: done steps show a check, the current one
 * is in ink-gray-9. A row on wide screens, a short stacked list on phones.
 */
export default function ImportStepper({ steps, current }) {
  return (
    <ol className="import-stepper" aria-label="Import steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'current' : 'upcoming';
        return (
          <li
            key={label}
            className="import-stepper__step"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="import-stepper__node" aria-hidden>
              {state === 'done' ? <Check size={12} strokeWidth={2} /> : n}
            </span>
            <span className="import-stepper__label">
              {label}
              {state === 'done' && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
