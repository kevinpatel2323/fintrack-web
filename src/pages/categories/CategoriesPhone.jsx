import { ChevronLeft, ChevronRight, Download, Ellipsis, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import {
  Alert, Button, Dropdown, EmptyState, ListView, MobileSection, PageBody, Skeleton, TextInput,
} from '../../components/ui';
import { CategoryIcon } from '../../components/common/Category.jsx';
import { CategorySplitBody } from '../../components/categories/CategorySplitCard.jsx';
import { SpentCell, categoryRowText } from './shared.jsx';

/**
 * Categories on a phone (< 768px): the month switcher, the month's split as a
 * donut, then every category as a row list (frappe-ui AccountingMobile and
 * FilesMobile). Tapping a row opens it in the edit sheet; its `…` holds Edit,
 * Export CSV and Delete. The page (Categories.jsx) owns the data and dialogs.
 */
export default function CategoriesPhone({
  month,
  monthOffset,
  onMonthChange,
  summary,
  query,
  onQueryChange,
  noCategories,
  loading,
  loadError,
  onRetryLoad,
  breakdownError,
  breakdownLoading,
  onRetryBreakdown,
  showList,
  groups,
  rows,
  splitItems,
  splitTotal,
  onCreate,
  onEdit,
  onExport,
  onDelete,
}) {
  if (noCategories) {
    return (
      <PageBody className="catg-ph">
        <EmptyState
          className="catg-ph-empty"
          icon={Tags}
          title="No categories yet"
          description="Add categories to sort your spending, like Food or Rent."
          action={<Button size="lg" variant="solid" iconLeft={Plus} label="Add category" onClick={onCreate} />}
        />
      </PageBody>
    );
  }

  const q = query.trim();

  const columns = [
    {
      key: 'name',
      label: 'Category',
      width: 'minmax(0, 1fr)',
      flex: true,
      sortable: true,
      sortValue: (row) => (row.uncategorised ? 'Uncategorised' : row.cat.name),
      render: (row) => <PhoneNameCell row={row} loading={breakdownLoading} />,
    },
    {
      key: 'spent',
      label: 'Spent',
      width: 'auto',
      align: 'right',
      sortable: true,
      sortFirst: 'desc',
      sortValue: (row) => row.stat?.totalAmount ?? 0,
      render: (row) => (
        <span className="catg-ph-amount">
          <SpentCell stat={row.stat} loading={breakdownLoading} />
        </span>
      ),
    },
    {
      key: 'actions',
      label: <span className="sr-only">Actions</span>,
      width: 36,
      align: 'right',
      render: (row) =>
        row.uncategorised ? null : (
          <Dropdown
            label={row.cat.name}
            options={[
              {
                items: [
                  { label: 'Edit', icon: Pencil, onClick: () => onEdit(row.cat) },
                  { label: 'Export CSV', icon: Download, onClick: () => onExport(row.cat) },
                ],
              },
              { items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: () => onDelete(row.cat) }] },
            ]}
          >
            <Button variant="ghost" size="md" icon={Ellipsis} label={`Actions for ${row.cat.name}`} />
          </Dropdown>
        ),
    },
  ];

  return (
    <PageBody className="catg-ph">
      <div className="catg-ph-month" role="group" aria-label="Month">
        <Button variant="ghost" size="md" icon={ChevronLeft} label="Previous month" onClick={() => onMonthChange(-1)} />
        <span className="catg-ph-month__label" aria-live="polite">{month.label}</span>
        <Button
          variant="ghost"
          size="md"
          icon={ChevronRight}
          label="Next month"
          disabled={monthOffset >= 0}
          onClick={() => onMonthChange(1)}
        />
      </div>

      {loadError && (
        <Alert
          className="catg-ph-alert"
          theme="red"
          title="Couldn't load categories"
          description={loadError}
          primaryAction={{ label: 'Try again', onClick: onRetryLoad }}
        />
      )}

      <MobileSection title="Spending by category">
        <div className="catg-ph-chart">
          <CategorySplitBody
            month={month}
            items={splitItems}
            total={splitTotal}
            loading={breakdownLoading || loading}
            error={breakdownError}
            onRetry={onRetryBreakdown}
            size={168}
          />
        </div>
      </MobileSection>

      {showList && (
        <MobileSection title="Categories" description={summary || undefined} className="catg-ph-section">
          <div className="catg-ph-search">
            <TextInput
              type="search"
              size="md"
              prefix={Search}
              placeholder="Search categories"
              aria-label="Search categories"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <ListView
            className="phone-bleed catg-ph-list"
            aria-label={`Categories, ${month.label}`}
            columns={columns}
            rows={rows}
            groups={groups}
            rowKey="id"
            loading={loading}
            onRowClick={(row) => {
              if (!row.uncategorised) onEdit(row.cat);
            }}
            rowClassName={(row) => (row.uncategorised ? 'catg-ph-row--static' : '')}
            emptyState={
              q ? (
                <EmptyState
                  size="sm"
                  icon={Search}
                  title={`No category matches “${q}”`}
                  action={<Button label="Clear search" onClick={() => onQueryChange('')} />}
                />
              ) : null
            }
          />
        </MobileSection>
      )}
    </PageBody>
  );
}

/** The 32px tile, the name and one muted line with the month's figures. */
function PhoneNameCell({ row, loading }) {
  const { cat, uncategorised } = row;
  const { hint, usage } = categoryRowText(row, loading);
  // The title already says "Uncategorised", so its line is just the figures.
  const line = usage || hint;
  return (
    <span className="catg-ph-name">
      <CategoryIcon category={cat} size={32} />
      <span className="catg-ph-name__text">
        <span className="catg-ph-name__title">{uncategorised ? 'Uncategorised' : cat.name}</span>
        {line ? (
          <span className="catg-ph-name__sub">{line}</span>
        ) : (
          loading && <Skeleton as="span" width={96} height={10} />
        )}
      </span>
    </span>
  );
}
