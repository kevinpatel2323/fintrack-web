import { useState } from 'react';
import { ClipboardCheck, Plus, Search, Users } from 'lucide-react';
import {
  ActionSheet, Amount, Avatar, Button, EmptyState, ListView, MobileList, MobileListItem, PageBody, PageHeader,
  StatCard, TabButtons, TextInput,
} from '../../components/ui';
import ListToolbar from '../../components/common/ListToolbar.jsx';
import { avatarTheme } from '../../components/ui/AvatarGroup.jsx';
import { useReviewSummary } from '../../hooks/useReviewSummary.js';
import {
  BalanceCell, FILTERS, STATUS, balanceSide, fmtActivity, people, reviewDetail, reviewHref,
} from './peopleList.jsx';

// Phones drop the Columns menu: the list shows the name (side and last
// activity under it) and the balance. Status and Last activity stay as
// columns only so the "Sorted by …" sheet can order by them.
const COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    width: 'minmax(0, 1fr)',
    flex: true,
    sortable: true,
    render: (f) => {
      const side = balanceSide(Number(f.summary?.netBalance || 0));
      const activity = fmtActivity(f.summary?.lastTransactionDate);
      return (
        <span className="people-m-name">
          <Avatar label={f.name} size="xl" theme={avatarTheme(f.id)} aria-hidden />
          <span className="people-m-name__text">
            <span className="people-m-name__label">{f.name}</span>
            <span className="people-m-name__meta">
              {STATUS[side].label}
              {activity ? ` · ${activity}` : ''}
            </span>
          </span>
        </span>
      );
    },
  },
  { key: 'status', label: 'Status', width: 120, sortable: true, hideBelow: 'md', render: () => null },
  { key: 'activity', label: 'Last activity', width: 140, sortable: true, sortFirst: 'desc', hideBelow: 'md', render: () => null },
  {
    key: 'balance',
    label: 'Balance',
    width: 'auto',
    align: 'right',
    sortable: true,
    sortFirst: 'desc',
    render: (f) => <BalanceCell value={Number(f.summary?.netBalance || 0)} />,
  },
];

/**
 * People on a phone (frappe-ui AccountingMobile / FilesMobile): the review
 * nudge when there is one, two summary tiles, a pinned search with the
 * balance segments, then the people as ListView rows. Same state as the
 * desktop page (pages/Friends.jsx); nothing is fetched here.
 */
export default function FriendsPhone({
  counts,
  filter,
  onFilterChange,
  queryInput,
  onQueryInput,
  query,
  rows,
  sort,
  onSortChange,
  loading,
  error,
  onRetry,
  noPeople,
  emptyCopy,
  owedToMe,
  iOwe,
  sideCounts,
  onAdd,
}) {
  let list;
  if (error) {
    list = (
      <EmptyState
        icon={Users}
        title="Could not load people"
        description={error}
        action={<Button size="md" label="Try again" onClick={onRetry} />}
      />
    );
  } else if (noPeople) {
    list = (
      <EmptyState
        icon={Users}
        title="No people yet"
        description="Add someone to start tracking shared expenses."
        action={<Button size="md" variant="subtle" iconLeft={Plus} label="Add person" onClick={onAdd} />}
      />
    );
  } else {
    list = (
      <ListView
        className="people-m-list phone-bleed"
        aria-label="People"
        columns={COLUMNS}
        rows={rows}
        rowHref={(f) => `/friends/${f.id}`}
        sort={sort}
        onSortChange={onSortChange}
        pagination
        loading={loading}
        emptyState={<EmptyState size="sm" title={emptyCopy.title} description={emptyCopy.description} />}
      />
    );
  }

  const showControls = !error && !noPeople;

  return (
    <>
      <PageHeader
        title="People"
        mobileActions={<Button variant="ghost" size="md" icon={Plus} label="Add person" onClick={onAdd} />}
      />
      <PageBody className="people-m">
        <ReviewRow />
        {showControls && (
          <div className="people-m-tiles">
            <StatCard
              label="Owed to you"
              value={<Amount value={owedToMe} tone={owedToMe > 0 ? 'in' : 'inherit'} />}
              hint={sideCounts.owed > 0 ? `From ${people(sideCounts.owed)}` : 'No one owes you'}
              loading={loading}
            />
            <StatCard
              label="You owe"
              value={<Amount value={iOwe} tone="inherit" />}
              hint={sideCounts.owe > 0 ? `To ${people(sideCounts.owe)}` : 'You owe no one'}
              loading={loading}
            />
          </div>
        )}
        {showControls && (
          <ListToolbar className="people-m-toolbar">
            <TextInput
              className="people-m-search"
              type="search"
              size="md"
              prefix={Search}
              placeholder={counts.all > 0 && !query ? `Search ${people(counts.all)}` : 'Search people'}
              aria-label="Search people"
              value={queryInput}
              onChange={(e) => onQueryInput(e.target.value)}
            />
            <TabButtons
              className="people-m-segments"
              aria-label="Balance filter"
              fluid
              value={filter}
              onChange={onFilterChange}
              options={FILTERS.map((f) => ({
                value: f.id,
                label: (
                  <>
                    {f.label}
                    <span className="people-count">{counts[f.id]}</span>
                  </>
                ),
              }))}
            />
          </ListToolbar>
        )}
        {list}
      </PageBody>
    </>
  );
}

/**
 * Older settlements to review (the People tab's badge), as an attention row
 * at the top: one person opens their review; several open a sheet to pick.
 */
function ReviewRow() {
  const { data } = useReviewSummary();
  const [picking, setPicking] = useState(false);
  const friends = (data?.friends ?? []).filter((f) => f.needingReview > 0);
  if (friends.length === 0) return null;
  const n = data.needingReview;
  const single = friends.length === 1;
  const title = `${n} older ${n === 1 ? 'settlement needs' : 'settlements need'} review`;

  return (
    <>
      <MobileList variant="inset" className="people-m-attention" aria-label="Needs attention">
        <MobileListItem
          leading={<ClipboardCheck className="people-m-attention__icon" size={20} strokeWidth={1.5} aria-hidden />}
          title={title}
          subtitle={single ? `With ${friends[0].friendName} · ${reviewDetail(friends[0])}` : `With ${friends.map((f) => f.friendName).join(', ')}`}
          to={single ? reviewHref(friends[0]) : undefined}
          onClick={single ? undefined : () => setPicking(true)}
          chevron
        />
      </MobileList>
      {!single && (
        <ActionSheet
          open={picking}
          onClose={() => setPicking(false)}
          title="Review settlements with"
          description="Saved before Fintrack recorded amounts, they don't match their entries."
          options={friends.map((f) => ({ label: f.friendName, description: reviewDetail(f), to: reviewHref(f) }))}
        />
      )}
    </>
  );
}
