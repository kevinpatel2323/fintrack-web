import { CalendarClock } from 'lucide-react';
import {
  Amount, Badge, Card, EmptyState, MobileList, MobileListItem, MobileSection,
} from '../../components/ui';
import { CategoryIcon } from '../../components/common/Category.jsx';
import { formatDayMedium, formatDayShort } from './calendarModel.js';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/**
 * One expected subscription charge. Opens the subscription for editing when
 * `onOpen` is given. `showDate` swaps the category tile for the bill's date
 * (lists that span several days).
 */
export function BillRow({ occ, category, showDate = false, past = false, onOpen }) {
  const meta = [occ.merchantLabel || 'Subscription'];
  if (occ.trialEndsOn) meta.push(`Trial ends ${formatDayShort(occ.trialEndsOn)}`);
  const inner = (
    <>
      {showDate ? (
        <span className="cal-bill__date tabular-nums">{formatDayShort(occ.date)}</span>
      ) : (
        <CategoryIcon category={category} size={28} />
      )}
      <span className="cal-bill__text">
        <span className="cal-bill__name truncate">{occ.name}</span>
        <span className="cal-bill__meta truncate">{meta.join(' · ')}</span>
      </span>
      {occ.isTrial && <Badge theme="violet" size="sm" label="Trial" />}
      <Amount value={Number(occ.amount || 0)} sign="never" tone={past ? 'muted' : 'out'} className="cal-bill__amount" />
    </>
  );
  return (
    <li className={cx('cal-bill', past && 'is-past')}>
      {onOpen ? (
        <button type="button" className="cal-bill__body is-interactive" onClick={onOpen}>
          {inner}
        </button>
      ) : (
        <div className="cal-bill__body">{inner}</div>
      )}
    </li>
  );
}

/**
 * A card listing subscription bills. `items` are occurrences already
 * filtered and sorted by the caller; bills before `todayIso` read as past.
 */
export function BillsCard({
  title,
  description,
  items,
  todayIso,
  subsById,
  categoriesById,
  onOpenSubscription,
  actions,
  emptyTitle,
  emptyDescription,
  loading = false,
}) {
  return (
    <Card as="section" title={title} description={description} actions={actions} padding="none" className="cal-card">
      {items.length > 0 ? (
        <ul className="cal-bills">
          {items.map((o) => {
            const sub = subsById.get(String(o.subscriptionId));
            return (
              <BillRow
                key={`${o.subscriptionId}-${o.date}`}
                occ={o}
                category={categoriesById.get(String(o.categoryId))}
                showDate
                past={o.date < todayIso}
                onOpen={sub ? () => onOpenSubscription(sub) : undefined}
              />
            );
          })}
        </ul>
      ) : (
        !loading && <EmptyState size="sm" icon={CalendarClock} title={emptyTitle} description={emptyDescription} />
      )}
    </Card>
  );
}

/**
 * Phone: subscription bills as a list of rows (category tile, name, date and
 * merchant, amount). `showDate` adds the bill's date to the second line, for
 * lists that span several days. Bills before `todayIso` read as past.
 */
export function PhoneBillList({ items, todayIso, subsById, categoriesById, onOpenSubscription, showDate = true, label }) {
  return (
    <MobileList aria-label={label} className="cal-pbills">
      {items.map((o) => {
        const sub = subsById.get(String(o.subscriptionId));
        const past = todayIso ? o.date < todayIso : false;
        const meta = [showDate ? formatDayMedium(o.date) : null, o.merchantLabel || (showDate ? null : 'Subscription')];
        if (o.trialEndsOn) meta.push(`Trial ends ${formatDayShort(o.trialEndsOn)}`);
        return (
          <MobileListItem
            key={`${o.subscriptionId}-${o.date}`}
            className={cx('cal-pbill', past && 'is-past')}
            leading={<CategoryIcon category={categoriesById.get(String(o.categoryId))} size={32} />}
            title={o.name}
            subtitle={meta.filter(Boolean).join(' · ')}
            value={<Amount value={Number(o.amount || 0)} sign="never" tone={past ? 'muted' : 'out'} />}
            valueSub={o.isTrial ? 'Trial' : undefined}
            onClick={sub ? () => onOpenSubscription(sub) : undefined}
          />
        );
      })}
    </MobileList>
  );
}

/**
 * Phone counterpart of BillsCard: a titled section (not a boxed card) with
 * the bills as rows, or a short empty state.
 */
export function BillsSection({
  title,
  description,
  action,
  items,
  todayIso,
  subsById,
  categoriesById,
  onOpenSubscription,
  emptyTitle,
  emptyDescription,
  loading = false,
  className,
}) {
  return (
    <MobileSection title={title} description={description} action={action} className={cx('cal-psection', className)}>
      {items.length > 0 ? (
        <PhoneBillList
          items={items}
          todayIso={todayIso}
          subsById={subsById}
          categoriesById={categoriesById}
          onOpenSubscription={onOpenSubscription}
          label={title}
        />
      ) : (
        !loading && (
          <EmptyState
            size="sm"
            icon={CalendarClock}
            title={emptyTitle}
            description={emptyDescription}
            className="cal-pempty"
          />
        )
      )}
    </MobileSection>
  );
}
