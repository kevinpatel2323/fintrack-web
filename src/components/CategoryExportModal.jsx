import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Dialog, ErrorMessage, FormControl, toast } from './ui';
import { formatDate } from './ui/DatePicker.jsx';
import { categoryColor } from '../utils/categoryColors.js';
import { downloadCategoryCsv } from '../services/categoriesApi.js';
import { useIsCompact } from '../styles/breakpoints.js';
import './categories/category-dialogs.css';

function pad(n) {
  return String(n).padStart(2, '0');
}

function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function presetRange(preset) {
  const today = new Date();
  switch (preset) {
    case 'thisMonth':
      return { start: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), end: ymd(today) };
    case '30days': {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      return { start: ymd(start), end: ymd(today) };
    }
    case 'thisYear':
      return { start: ymd(new Date(today.getFullYear(), 0, 1)), end: ymd(today) };
    default:
      return { start: '', end: '' };
  }
}

const PERIODS = [
  { label: 'All time', value: 'all' },
  { label: 'This month', value: 'thisMonth' },
  { label: 'Last 30 days', value: '30days' },
  { label: 'This year', value: 'thisYear' },
  { label: 'Custom range', value: 'custom' },
];

function rangeText({ start, end }) {
  if (!start && !end) return 'Every transaction in the category.';
  return `${formatDate(start)} to ${formatDate(end)}`;
}

/**
 * Downloads a category's transactions as CSV, optionally for a date range.
 *
 * `category` preselects one (the row's "Export CSV"). Pass `categories` to
 * let the user pick, e.g. from the page header's "Export".
 */
export default function CategoryExportModal({ category, categories, open, onClose }) {
  // Phones: the dialog docks as a bottom sheet; its fields are 44px there.
  const fieldSize = useIsCompact() ? 'lg' : undefined;
  const [categoryId, setCategoryId] = useState(null);
  const [period, setPeriod] = useState('all');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // Reset to the "all time" default whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setCategoryId(category?.id ?? null);
      setPeriod('all');
      setCustom({ start: '', end: '' });
      setBusy(false);
      setStatus('');
    }
  }, [open, category?.id]);

  const list = useMemo(() => categories || (category ? [category] : []), [categories, category]);
  const options = useMemo(
    () =>
      [...list]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({
          label: c.name,
          value: c.id,
          icon: <span className="catx-dot" style={{ background: categoryColor(c) }} aria-hidden />,
        })),
    [list],
  );

  const range = period === 'custom' ? custom : presetRange(period);
  const customMissing = period === 'custom' && (!custom.start || !custom.end);
  const selected = list.find((c) => String(c.id) === String(categoryId)) || null;

  async function exportCsv() {
    if (!selected || customMissing) return;
    setBusy(true);
    setStatus('');
    try {
      const filename = await downloadCategoryCsv(selected.id, {
        start: range.start || undefined,
        end: range.end || undefined,
      });
      toast.success({ title: 'Export downloaded', description: filename });
      onClose();
    } catch (e) {
      setStatus(e.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Export to CSV"
      description="Download a category's transactions as a spreadsheet."
      actions={[
        { label: 'Cancel', disabled: busy },
        {
          label: 'Export CSV',
          variant: 'solid',
          icon: Download,
          loading: busy,
          loadingText: 'Exporting…',
          disabled: !selected || customMissing,
          onClick: exportCsv,
        },
      ]}
    >
      {categories ? (
        <FormControl
          type="combobox"
          size={fieldSize}
          label="Category"
          placeholder="Choose a category"
          searchPlaceholder="Search categories"
          options={options}
          value={categoryId}
          onChange={setCategoryId}
        />
      ) : (
        selected && (
          <div className="catx-fixed">
            <span className="catx-dot" style={{ background: categoryColor(selected) }} aria-hidden />
            <span className="truncate">{selected.name}</span>
          </div>
        )
      )}

      <FormControl
        type="select"
        size={fieldSize}
        label="Period"
        options={PERIODS}
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        description={period === 'custom' ? undefined : rangeText(range)}
      />

      {period === 'custom' && (
        <FormControl
          type="daterange"
          size={fieldSize}
          label="Dates"
          placeholder="Pick a start and end date"
          value={custom}
          onChange={setCustom}
        />
      )}

      <ErrorMessage message={status} />
    </Dialog>
  );
}
