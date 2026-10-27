import { MoreHorizontal, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import {
  Alert, Amount, Badge, Button, Dropdown, EmptyState, ListView, Skeleton,
} from '../../components/ui';
import { CategoryBadge } from '../../components/common/Category.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { BillsCard } from './Bills.jsx';
import { describeRRule } from './cadence.js';
import { formatDayShort, subscriptionStatus } from './calendarModel.js';

function StatusBadge({ sub }) {
  const { label, theme } = subscriptionStatus(sub);
  const trialEnd = sub.isTrial && sub.trialEndsOn ? `Trial ends ${formatDayShort(sub.trialEndsOn)}` : undefined;
  return (
    <span className="cal-sub-status" title={trialEnd}>
      <Badge theme={theme} label={label} />
    </span>
  );
}

/**
 * Subscriptions tab: every recurring bill (name, amount, how it repeats, its
 * next date, status) with the month's bills beside it. Rows open the edit
 * dialog; Delete sits in each row's menu and in the dialog.
 */
export default function SubscriptionsView({
  compact,
  subs,
  loading,
  error,
  onRetry,
  nextById,
  categoriesById,
  subsById,
  monthBills,
  monthName,
  monthTotal,
  todayIso,
  onNew,
  onEdit,
  onDelete,
}) {
  const wide = useMediaQuery('(min-width: 1440px)');
  const activeCount = subs.filter((s) => (s.status || 'active') === 'active').length;
  const categoryOf = (row) => row.category || categoriesById.get(String(row.categoryId)) || null;
  const nextOf = (row) => nextById.get(String(row.id));

  const columns = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(140px, 2fr)',
      render: (row) => (
        <span className="cal-sub-name">
          <span className="cal-sub-name__title truncate">{row.name}</span>
          {row.merchantLabel && <span className="cal-sub-name__meta truncate">{row.merchantLabel}</span>}
        </span>
      ),
    },
    // The category column only fits beside the bills panel on wide screens.
    wide && {
      key: 'category',
      label: 'Category',
      width: 150,
      render: (row) => (categoryOf(row)
        ? <CategoryBadge category={categoryOf(row)} />
        : <span className="text-ink-gray-4">—</span>),
    },
    {
      key: 'rrule',
      label: 'Repeats',
      width: 'minmax(120px, 1.2fr)',
      render: (row) => <span className="truncate" title={row.rrule}>{describeRRule(row.rrule)}</span>,
    },
    {
      key: 'next',
      label: 'Next',
      width: 80,
      render: (row) => (nextOf(row)
        ? <span className="tabular-nums">{formatDayShort(nextOf(row))}</span>
        : <span className="text-ink-gray-4">—</span>),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 100,
      align: 'right',
      render: (row) => <Amount value={Number(row.amount || 0)} sign="never" tone="out" />,
    },
    { key: 'status', label: 'Status', width: 96, render: (row) => <StatusBadge sub={row} /> },
    {
      key: 'actions',
      label: '',
      width: 36,
      align: 'right',
      render: (row) => (
        <Dropdown
          placement="bottom-end"
          options={[
            { items: [{ label: 'Edit', icon: Pencil, onClick: () => onEdit(row) }] },
            { items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: () => onDelete(row) }] },
          ]}
        >
          <Button variant="ghost" icon={MoreHorizontal} label={`Actions for ${row.name}`} />
        </Dropdown>
      ),
    },
  ].filter(Boolean);

  const empty = (
    <EmptyState
      icon={Repeat}
      title="No subscriptions yet"
      description="Add rent, streaming and other recurring bills to see them on the calendar."
      // The header already carries the solid "New subscription" on desktop.
      action={<Button variant={compact ? 'solid' : 'subtle'} iconLeft={Plus} label="New subscription" onClick={onNew} />}
    />
  );

  const summary = !loading && subs.length > 0 && (
    <p className="cal-summary">
      {subs.length} subscription{subs.length === 1 ? '' : 's'} · {activeCount} active
    </p>
  );

  const bills = (
    <BillsCard
      title={`Due in ${monthName}`}
      description={monthBills.length > 0 ? <Amount value={monthTotal} sign="never" tone="inherit" /> : null}
      items={monthBills}
      todayIso={todayIso}
      subsById={subsById}
      categoriesById={categoriesById}
      onOpenSubscription={onEdit}
      emptyTitle={`No bills in ${monthName}`}
      emptyDescription="Active subscriptions show here on the dates they repeat."
    />
  );

  const alert = error && (
    <Alert
      theme="red"
      title="Couldn’t load subscriptions"
      description={error}
      primaryAction={{ label: 'Try again', onClick: onRetry }}
    />
  );

  if (compact) {
    return (
      <div className="cal-stack">
        {alert}
        {summary}
        {loading && subs.length === 0 ? (
          <div className="cal-sub-list" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="cal-sub-row"><Skeleton height={14} width="60%" /></div>
            ))}
          </div>
        ) : subs.length === 0 ? (
          !error && empty
        ) : (
          <ul className="cal-sub-list" aria-label="Subscriptions">
            {subs.map((row) => {
              const next = nextOf(row);
              const meta = [describeRRule(row.rrule), next ? `Next ${formatDayShort(next)}` : null].filter(Boolean).join(' · ');
              return (
                <li key={row.id}>
                  <button type="button" className="cal-sub-row" onClick={() => onEdit(row)}>
                    <span className="cal-sub-row__text">
                      <span className="cal-sub-row__name truncate">{row.name}</span>
                      <span className="cal-sub-row__meta truncate">{meta}</span>
                    </span>
                    <span className="cal-sub-row__end">
                      <Amount value={Number(row.amount || 0)} sign="never" tone="out" />
                      <StatusBadge sub={row} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {bills}
      </div>
    );
  }

  return (
    <div className="cal-layout cal-layout--subs">
      <div className="cal-main">
        {alert}
        {summary}
        {!(error && subs.length === 0) && (
          <ListView
            aria-label="Subscriptions"
            columns={columns}
            rows={subs}
            onRowClick={(row) => onEdit(row)}
            loading={loading}
            emptyState={empty}
          />
        )}
      </div>
      <aside className="cal-aside" aria-label={`Bills due in ${monthName}`}>
        {bills}
      </aside>
    </div>
  );
}
