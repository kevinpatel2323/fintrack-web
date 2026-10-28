import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown, ChevronLeft, ChevronRight, Ellipsis, Plus, RefreshCw, Search, SlidersHorizontal, Upload, X,
} from 'lucide-react';
import TransactionMobileList from '../components/TransactionMobileList.jsx';
import { transactionSortChoices } from '../components/TransactionTable.jsx';
import { CategoryIcon } from '../components/common/Category.jsx';
import ListToolbar, { useStickyHeight } from '../components/common/ListToolbar.jsx';
import { TYPE_OPTIONS, TransactionFilterSheet } from '../components/transactions/TransactionFilters.jsx';
import {
  accountHint,
  adjacentMonths,
  formatMonthLong,
  formatRangeLabel,
  sliceWholeDays,
} from '../components/transactions/transactionListModel.js';
import {
  ActionSheet, Alert, Amount, Badge, Button, Dropdown, ErrorMessage, PageBody, PageHeader, Skeleton, TabButtons,
  TextInput,
} from '../components/ui';
import { UNCATEGORISED_FILTER } from '../utils/transactionsListParams.js';

/** Rows the list shows at first, and adds per "Show more". */
const STEP = 50;
const DEFAULT_SORT = { key: 'date', direction: 'desc' };
const SORT_CHOICES = transactionSortChoices();

/** How a sort reads: "Newest first", "Most spent first", "A to Z". */
function directionText(key, direction) {
  const asc = direction === 'asc';
  if (key === 'date') return asc ? 'Oldest first' : 'Newest first';
  // The page orders amounts by spend (withdrawal − deposit).
  if (key === 'amount') return asc ? 'Most received first' : 'Most spent first';
  if (key === 'tags') return asc ? 'Fewest people first' : 'Most people first';
  return asc ? 'A to Z' : 'Z to A';
}

function PhoneSkeleton() {
  return (
    <div className="txns-phone-skeleton" aria-busy="true" aria-label="Loading transactions">
      <div className="txns-phone-skeleton__head">
        <Skeleton height={12} width={88} />
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div className="txns-phone-skeleton__row" key={i}>
          <Skeleton width={32} height={32} />
          <div className="txns-phone-skeleton__text">
            <Skeleton height={14} width={`${68 - (i % 3) * 12}%`} />
            <Skeleton height={11} width="38%" />
          </div>
          <Skeleton height={14} width={64} />
        </div>
      ))}
    </div>
  );
}

/** A removable active-filter chip under the search. */
function FilterChip({ icon, label, onRemove }) {
  return (
    <button type="button" className="txns-phone-chip" onClick={onRemove} aria-label={`Remove filter: ${label}`}>
      {icon}
      <span className="txns-phone-chip__label">{label}</span>
      <X className="txns-phone-chip__x" size={14} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}

/**
 * Activity on phones (frappe-ui FilesMobile + AccountingMobile): search and a
 * "Filter" button pinned at the top of the scroll area with the active filters
 * as removable chips; the period with month steps and its totals; an
 * All / Spent / Earned segment; then the transactions by day, growing by
 * "Show more". The header holds "+" (new transaction) and "…" (import, sort,
 * refresh). Everything comes from the page: its state, URL filters and
 * handlers — this only lays them out.
 */
export default function TransactionsPhone({
  onNewTransaction,
  onRefresh,
  searchDraft,
  search,
  onSearchChange,
  filterTab,
  onFilterTabChange,
  rangeStart,
  rangeEnd,
  onRangeChange,
  monthOptions,
  selectedMonth,
  accounts,
  account,
  onAccountChange,
  categories,
  categoryFilterOptions,
  categoryFilter,
  onCategoryFilterChange,
  activeFilterCount,
  onResetFilters,
  sort,
  onSortChange,
  rows,
  totalCount,
  filteredCount,
  hasClientFilters,
  totalSpent,
  totalEarned,
  loading,
  loadError,
  hasTransactions,
  pageErrors,
  emptyState,
  onAssignCategory,
  onOpenDetail,
}) {
  const [toolbarRef, toolbarHeight] = useStickyHeight();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [limit, setLimit] = useState(STEP);

  // A new filter, period or order starts the list from the top again.
  useEffect(() => {
    setLimit(STEP);
  }, [filterTab, search, categoryFilter, account, rangeStart, rangeEnd, sort.key, sort.direction]);

  const byDate = sort.key === 'date';
  const visibleRows = useMemo(
    () => (byDate ? sliceWholeDays(rows, limit) : rows.slice(0, limit)),
    [rows, limit, byDate],
  );

  const { older, newer } = adjacentMonths(selectedMonth, monthOptions);
  const periodTitle = selectedMonth ? formatMonthLong(selectedMonth) : formatRangeLabel(rangeStart, rangeEnd);
  const isDefaultSort = sort.key === DEFAULT_SORT.key && sort.direction === DEFAULT_SORT.direction;
  const sortChoice = SORT_CHOICES.find((c) => c.key === sort.key);

  const pickSort = (choice) => onSortChange(
    sort.key === choice.key
      ? { key: choice.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
      : { key: choice.key, direction: choice.sortFirst },
  );

  const moreOptions = [
    { label: 'Import statement', icon: Upload, to: '/import' },
    {
      label: 'Sort by',
      icon: ArrowUpDown,
      description: sortChoice ? `${sortChoice.label} · ${directionText(sort.key, sort.direction)}` : undefined,
      onClick: () => setSortOpen(true),
    },
    { label: 'Refresh', icon: RefreshCw, onClick: onRefresh },
  ];

  // Filters that don't show elsewhere on the screen: the segment shows the
  // type and the period heading shows the period.
  const chips = [];
  if (categoryFilter) {
    const category = categories.find((c) => String(c.id) === String(categoryFilter));
    chips.push(
      <FilterChip
        key="category"
        icon={category ? <CategoryIcon category={category} size={18} /> : null}
        label={categoryFilter === UNCATEGORISED_FILTER ? 'Uncategorised' : category?.name || 'Category'}
        onRemove={() => onCategoryFilterChange('')}
      />,
    );
  }
  if (account) {
    chips.push(
      <FilterChip key="account" label={`Account ${accountHint(account)}`} onRemove={() => onAccountChange('')} />,
    );
  }
  if (!isDefaultSort && sortChoice) {
    chips.push(
      <FilterChip
        key="sort"
        icon={<ArrowUpDown className="txns-phone-chip__icon" size={14} strokeWidth={1.5} aria-hidden="true" />}
        label={`${sortChoice.label} · ${directionText(sort.key, sort.direction)}`}
        onRemove={() => onSortChange(DEFAULT_SORT)}
      />,
    );
  }

  const total = rows.length;
  const shown = visibleRows.length;
  const plural = (n) => `${n} transaction${n === 1 ? '' : 's'}`;
  let countLabel = plural(totalCount);
  if (totalCount === 0) countLabel = 'No transactions';
  else if (hasClientFilters) countLabel = `${filteredCount} of ${plural(totalCount)}`;

  return (
    <>
      <PageHeader
        title="Activity"
        mobileActions={(
          <>
            <Button variant="ghost" size="md" icon={Plus} label="New transaction" onClick={onNewTransaction} />
            <Dropdown options={moreOptions} label="Activity">
              <Button variant="ghost" size="md" icon={Ellipsis} label="More actions" />
            </Dropdown>
          </>
        )}
      />
      <PageBody className="txns-phone" style={{ '--list-toolbar-height': `${toolbarHeight}px` }}>
        <ListToolbar ref={toolbarRef} className="txns-phone-toolbar">
          <div className="txns-phone-toolbar__row">
            <TextInput
              className="txns-phone-search"
              type="search"
              size="md"
              prefix={Search}
              placeholder="Search transactions"
              aria-label="Search transactions"
              enterKeyHint="search"
              value={searchDraft}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <Button
              size="md"
              iconLeft={SlidersHorizontal}
              iconRight={activeFilterCount > 0
                ? <Badge variant="solid" size="sm" label={activeFilterCount} aria-hidden="true" />
                : undefined}
              label="Filter"
              aria-label={activeFilterCount ? `Filter, ${activeFilterCount} active` : 'Filter'}
              aria-haspopup="dialog"
              active={activeFilterCount > 0}
              onClick={() => setFiltersOpen(true)}
            />
          </div>
          {chips.length > 0 && (
            <div className="txns-phone-chips" role="group" aria-label="Active filters">
              {chips}
            </div>
          )}
        </ListToolbar>

        <section className="txns-phone-summary" aria-label="Period">
          <div className="txns-phone-summary__head">
            <h2 className="txns-phone-summary__title">{periodTitle}</h2>
            {!selectedMonth && monthOptions[0] && (
              <Button
                variant="ghost"
                size="md"
                label="This month"
                className="txns-phone-summary__reset"
                onClick={() => onRangeChange(monthOptions[0].startIso, monthOptions[0].endIso)}
              />
            )}
            {selectedMonth && (
              <div className="txns-phone-summary__step">
                <Button
                  variant="ghost"
                  size="md"
                  icon={ChevronLeft}
                  label={older ? `Previous month, ${formatMonthLong(older.value)}` : 'Previous month'}
                  disabled={!older}
                  onClick={() => older && onRangeChange(older.startIso, older.endIso)}
                />
                <Button
                  variant="ghost"
                  size="md"
                  icon={ChevronRight}
                  label={newer ? `Next month, ${formatMonthLong(newer.value)}` : 'Next month'}
                  disabled={!newer}
                  onClick={() => newer && onRangeChange(newer.startIso, newer.endIso)}
                />
              </div>
            )}
          </div>
          <div className="txns-phone-summary__meta" aria-live="polite">
            {loading ? (
              <Skeleton height={12} width="72%" />
            ) : totalCount === 0 ? (
              countLabel
            ) : (
              <>
                {countLabel}
                {' · '}
                <Amount value={totalSpent} sign="never" tone="inherit" /> spent
                {' · '}
                <Amount value={totalEarned} sign="always" tone={totalEarned > 0 ? 'in' : 'inherit'} /> earned
              </>
            )}
          </div>
        </section>

        <TabButtons
          fluid
          size="md"
          className="txns-phone-segment"
          aria-label="Type"
          options={TYPE_OPTIONS}
          value={filterTab}
          onChange={onFilterTabChange}
        />

        {pageErrors.length > 0 && <ErrorMessage message={pageErrors} />}
        {loadError && hasTransactions && (
          <Alert
            theme="red"
            title="Couldn't refresh transactions"
            description={loadError}
            primaryAction={{ label: 'Try again', onClick: onRefresh }}
          />
        )}

        {loading ? (
          <PhoneSkeleton />
        ) : total === 0 ? (
          <div className="txns-phone-empty">{emptyState}</div>
        ) : (
          <div className="txns-phone-list">
            <TransactionMobileList
              bleed
              rows={visibleRows}
              grouped={byDate}
              dayOrder={sort.direction}
              categories={categories}
              onAssignCategory={onAssignCategory}
              onOpenDetail={onOpenDetail}
            />
            {total > STEP && (
              <div className="txns-phone-more">
                <span className="txns-phone-more__count">{shown} of {total}</span>
                {shown < total && (
                  <Button
                    variant="subtle"
                    size="md"
                    label={`Show ${Math.min(STEP, total - shown)} more`}
                    onClick={() => setLimit(shown + STEP)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </PageBody>

      <TransactionFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        activeCount={activeFilterCount}
        onReset={onResetFilters}
        filterTab={filterTab}
        onFilterTabChange={onFilterTabChange}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onRangeChange={onRangeChange}
        monthOptions={monthOptions}
        accounts={accounts}
        account={account}
        onAccountChange={onAccountChange}
        categoryOptions={categoryFilterOptions}
        category={categoryFilter}
        onCategoryChange={onCategoryFilterChange}
        resultCount={filteredCount}
        loading={loading}
      />

      <ActionSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort by"
        description="Pick the same one again to reverse the order."
        options={SORT_CHOICES.map((choice) => ({
          key: choice.key,
          label: choice.label,
          selected: sort.key === choice.key,
          description: sort.key === choice.key ? directionText(choice.key, sort.direction) : undefined,
          onClick: () => pickSort(choice),
        }))}
      />
    </>
  );
}
