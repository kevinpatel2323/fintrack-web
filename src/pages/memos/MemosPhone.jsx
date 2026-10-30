import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Ellipsis, Plus, RefreshCw, RotateCw, Search, SlidersHorizontal, Smartphone,
} from 'lucide-react';
import ListToolbar, { useStickyHeight } from '../../components/common/ListToolbar.jsx';
import {
  adjacentMonths, formatMonthLong, formatRangeLabel,
} from '../../components/transactions/transactionListModel.js';
import {
  Badge, Button, Dropdown, ListView, PageBody, PageHeader, Skeleton, TabButtons, TextInput,
} from '../../components/ui';
import MemoFilterSheet from './MemoFilterSheet.jsx';
import { MEMO_DEFAULT_SORT, phoneMemoColumns } from './memoColumns.jsx';

/**
 * Memos on a phone (a pushed page under You), laid out like Activity
 * (TransactionsPhone): search and a "Filter" button pinned at the top of the
 * scroll area, the period with month steps and its totals, the All / No memo
 * / Debit / Credit segments, then the memos as ListView's phone rows — payee
 * over "date · account · memo", the amount trailing, "Sorted by …" and
 * "Show more". A row opens the memo's page, where the memo is written. The
 * header holds "+" (Connect iPhone) and "…" (Devices, Re-parse all,
 * Refresh). State, data and handlers all come from pages/Memos.jsx.
 */
export default function MemosPhone({
  searchDraft,
  onSearchChange,
  tab,
  tabOptions,
  onTabChange,
  start,
  end,
  onRangeChange,
  monthOptions,
  selectedMonth,
  activeFilterCount,
  onResetFilters,
  rows,
  accountNames,
  summaryContent,
  hasMemos,
  loading,
  refreshError,
  emptyState,
  onOpen,
  onConnect,
  onDevices,
  onReparseAll,
  onRefresh,
}) {
  const [toolbarRef, toolbarHeight] = useStickyHeight();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const columns = useMemo(() => phoneMemoColumns(accountNames), [accountNames]);

  const { older, newer } = adjacentMonths(selectedMonth, monthOptions);
  const periodTitle = selectedMonth ? formatMonthLong(selectedMonth) : formatRangeLabel(start, end);

  const moreOptions = [
    { label: 'Devices', icon: Smartphone, onClick: onDevices },
    { label: 'Re-parse all', icon: RotateCw, onClick: onReparseAll },
    { label: 'Refresh', icon: RefreshCw, onClick: onRefresh },
  ];

  let meta;
  if (loading && !hasMemos) meta = <Skeleton height={12} width="72%" />;
  else if (!hasMemos) meta = 'No memos';
  else meta = summaryContent;

  return (
    <>
      <PageHeader
        title="Memos"
        mobileActions={(
          <>
            <Button variant="ghost" size="md" icon={Plus} label="Connect iPhone" onClick={onConnect} />
            <Dropdown options={moreOptions} label="Memos">
              <Button variant="ghost" size="md" icon={Ellipsis} label="More actions" />
            </Dropdown>
          </>
        )}
      />
      <PageBody className="memos-m" style={{ '--list-toolbar-height': `${toolbarHeight}px` }}>
        <ListToolbar ref={toolbarRef} className="memos-m-toolbar">
          <div className="memos-m-toolbar__row">
            <TextInput
              className="memos-m-search"
              type="search"
              size="md"
              prefix={Search}
              placeholder="Search memos"
              aria-label="Search memos"
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
        </ListToolbar>

        <section className="memos-m-summary" aria-label="Period">
          <div className="memos-m-summary__head">
            <h2 className="memos-m-summary__title">{periodTitle}</h2>
            {!selectedMonth && monthOptions[0] && (
              <Button
                variant="ghost"
                size="md"
                label="This month"
                className="memos-m-summary__reset"
                onClick={() => onRangeChange(monthOptions[0].startIso, monthOptions[0].endIso)}
              />
            )}
            {selectedMonth && (
              <div className="memos-m-summary__step">
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
          <div className="memos-m-summary__meta" aria-live="polite">{meta}</div>
        </section>

        <TabButtons
          fluid
          className="memos-m-segments"
          aria-label="Show"
          options={tabOptions}
          value={tab}
          onChange={onTabChange}
        />

        {refreshError}

        <ListView
          className="memos-m-list phone-bleed"
          aria-label="Memos"
          columns={columns}
          rows={rows}
          onRowClick={onOpen}
          defaultSort={MEMO_DEFAULT_SORT}
          pagination
          loading={loading}
          skeletonRows={7}
          emptyState={emptyState}
        />
      </PageBody>

      <MemoFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        activeCount={activeFilterCount}
        onReset={onResetFilters}
        tab={tab}
        onTabChange={onTabChange}
        start={start}
        end={end}
        onRangeChange={onRangeChange}
        monthOptions={monthOptions}
        resultCount={rows.length}
        loading={loading}
      />
    </>
  );
}
