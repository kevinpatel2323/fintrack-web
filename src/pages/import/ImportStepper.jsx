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

/**
 * Phones: one line ("Step 2 of 3 · Review & map") over a thin three-part
 * progress bar, instead of the list of steps. `note` sits at the end of the
 * line (e.g. when the last import was).
 */
export function ImportStepperPhone({ steps, current, note }) {
  return (
    <div className="import-ph-steps">
      <div className="import-ph-steps__line">
        <p className="import-ph-steps__label" aria-live="polite">
          <span className="import-ph-steps__count">
            Step {current} of {steps.length} ·{' '}
          </span>
          <span className="import-ph-steps__name">{steps[current - 1]}</span>
        </p>
        {note && <span className="import-ph-steps__note">{note}</span>}
      </div>
      <div className="import-ph-steps__bar" aria-hidden>
        {steps.map((label, i) => (
          <span key={label} className="import-ph-steps__seg" data-done={i < current ? '' : undefined} />
        ))}
      </div>
    </div>
  );
}
