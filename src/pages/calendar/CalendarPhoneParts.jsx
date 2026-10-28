import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { Button, Switch, TabButtons } from '../../components/ui';

/**
 * Phone: the two rows under the header. The Transactions | Subscriptions
 * segment (the `?view=` param), then the month with Today and the arrows;
 * `children` is the muted line under the month (its totals).
 */
export function PhoneCalendarBar({ views, view, onViewChange, monthTitle, onPrev, onNext, onToday, children }) {
  return (
    <div className="cal-pbar">
      <TabButtons options={views} value={view} onChange={onViewChange} fluid aria-label="Calendar view" />
      <div className="cal-mbar">
        <div className="cal-mbar__row">
          <h2 className="cal-mbar__title" aria-live="polite">{monthTitle}</h2>
          <div className="cal-mbar__nav" role="group" aria-label="Month">
            <Button label="Today" onClick={onToday} />
            <Button variant="ghost" size="md" icon={ChevronLeft} label="Previous month" onClick={onPrev} />
            <Button variant="ghost" size="md" icon={ChevronRight} label="Next month" onClick={onNext} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Phone: the month's categorising to-do as one strip. How many are left and
 * on how many days, Focus (fade every other day on the grid) and Next (jump
 * to the next day to fix); a hairline along the bottom shows progress.
 */
export function PhonePendingStrip({ pending, monthName, focus, onFocusChange, onNext }) {
  const categorised = Math.max(pending.total - pending.pending, 0);
  if (pending.pending === 0) {
    return (
      <div className="cal-todo is-done" role="status">
        <CheckCircle2 className="cal-todo__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
        <p className="cal-todo__title">Every transaction in {monthName} has a category</p>
      </div>
    );
  }
  const days = pending.days.length;
  return (
    <div className="cal-todo" role="status">
      <Tag className="cal-todo__icon" size={16} strokeWidth={1.5} aria-hidden="true" />
      <div className="cal-todo__text">
        <p className="cal-todo__title">
          <strong>{pending.pending}</strong> to categorise
        </p>
        <p className="cal-todo__meta">
          {days} day{days === 1 ? '' : 's'} · {categorised} of {pending.total} done
        </p>
      </div>
      <Switch size="sm" label="Focus" checked={focus} onChange={onFocusChange} className="cal-todo__focus" />
      <Button label="Next" aria-label="Next day to fix" iconRight={ArrowRight} onClick={onNext} className="cal-todo__next" />
      <span className="cal-todo__track" aria-hidden="true">
        <span
          className="cal-todo__fill"
          style={{ width: `${pending.total ? Math.round((categorised / pending.total) * 100) : 0}%` }}
        />
      </span>
    </div>
  );
}
