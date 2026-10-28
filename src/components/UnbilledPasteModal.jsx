import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Amount, Badge, Dialog, ErrorMessage, FormControl, ListView, toast } from './ui';
import { cardLabel, dayLabel } from './cards/cardFormat.js';
import { previewUnbilledPaste, saveUnbilledPaste } from '../services/cardsApi.js';
import './cards/cards.css';

const STATUS = {
  new: { label: 'New', theme: 'green' },
  existing: { label: 'Already added', theme: 'gray' },
  billed_cycle: { label: 'Already billed', theme: 'gray' },
};

const statusOf = (r) => STATUS[r.status] || STATUS.existing;
const signed = (r) => (r.isRefund ? Number(r.amount) : -Number(r.amount));

// The preview table: the same columns as the import review, in paste order
// until a header is clicked. Date and Status fold under the merchant on phones.
const PREVIEW_COLUMNS = [
  {
    key: 'date',
    label: 'Date',
    width: 88,
    minWidth: 72,
    hideBelow: 'sm',
    sortable: true,
    sortFirst: 'desc',
    sortValue: (r) => r.txnDate || '',
    render: (r) => <span className="unbilled__date">{dayLabel(r.txnDate)}</span>,
  },
  {
    key: 'merchant',
    label: 'Merchant',
    width: 'minmax(160px, 1fr)',
    flex: true,
    sortable: true,
    sortValue: (r) => r.merchant || '',
    render: (r) => (
      <span className="unbilled__merchant">
        <span className="truncate" title={r.merchant}>{r.merchant}</span>
        <span className="unbilled__phone-meta">
          {dayLabel(r.txnDate)}
          {r.status !== 'new' && ` · ${statusOf(r).label}`}
        </span>
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: 128,
    minWidth: 96,
    hideBelow: 'sm',
    sortable: true,
    sortValue: (r) => statusOf(r).label,
    render: (r) => <Badge theme={statusOf(r).theme} label={statusOf(r).label} />,
  },
  {
    key: 'amount',
    label: 'Amount',
    width: 112,
    minWidth: 96,
    align: 'right',
    sortable: true,
    sortValue: signed,
    render: (r) => (
      <Amount
        value={signed(r)}
        sign={r.isRefund ? 'always' : 'never'}
        decimals={2}
        tone={r.status === 'new' ? undefined : 'muted'}
      />
    ),
  },
];

const PLACEHOLDER = 'Total Spent\n₹22,074.00\n…\n25 Oct 2026\nUpi-four Coffee\n₹735.00 debit icon';

/**
 * Paste the list from HDFC's Unbilled Transactions page (MyCards or
 * NetBanking). HDFC has no download for it, but the page copies cleanly.
 * Pasting again later only adds rows that are not on the card yet, and the
 * next statement import bills these rows in place instead of duplicating them.
 *
 * Two steps in one dialog: paste → preview (new vs already added) → add.
 */
export default function UnbilledPasteModal({ card, onClose, onSaved, open = true }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previewRows = useMemo(() => (preview?.rows || []).map((r, index) => ({ ...r, index })), [preview]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const check = () => run(async () => setPreview(await previewUnbilledPaste(card.id, text)));
  const save = () =>
    run(async () => {
      const result = await saveUnbilledPaste(card.id, text);
      const added = result?.insertedRows ?? preview?.newRows ?? 0;
      toast.success(`Added ${added} transaction${added === 1 ? '' : 's'}`);
      onSaved?.(result);
    });

  const newRows = preview?.newRows ?? 0;

  const actions = preview
    ? [
        { label: 'Back', icon: ArrowLeft, onClick: () => { setPreview(null); setError(''); }, disabled: busy },
        {
          label: newRows ? `Add ${newRows} transaction${newRows === 1 ? '' : 's'}` : 'Nothing new to add',
          variant: 'solid',
          onClick: save,
          loading: busy,
          loadingText: 'Adding…',
          disabled: newRows === 0,
        },
      ]
    : [
        { label: 'Cancel', onClick: () => onClose?.() },
        {
          label: 'Preview',
          variant: 'solid',
          onClick: check,
          loading: busy,
          loadingText: 'Checking…',
          disabled: !text.trim(),
        },
      ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title="Paste unbilled transactions"
      description={
        preview
          ? `Review what will be added to ${cardLabel(card)}.`
          : `Add spends to ${cardLabel(card)} before the statement is out.`
      }
      actions={actions}
    >
      {!preview ? (
        <>
          <ol className="unbilled__steps">
            <li>In HDFC MyCards or NetBanking, open Unbilled Transactions (Settled tab).</li>
            <li>Select the whole page, from “Total Spent” to the last row, and copy it.</li>
            <li>Paste it below. Rows already on the card are skipped.</li>
          </ol>
          <FormControl
            type="textarea"
            label="Copied text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            rows={10}
            placeholder={PLACEHOLDER}
            controlClassName="unbilled__textarea"
            autoFocus
          />
        </>
      ) : (
        <>
          <div className="unbilled__summary" role="status">
            <span>
              <strong>{preview.newRows}</strong> new
            </span>
            <span>{preview.existingRows} already on the card</span>
            {preview.billedCycleRows > 0 && (
              <span>{preview.billedCycleRows} in a billed cycle, skipped</span>
            )}
            {preview.totalSpent != null && (
              <span>
                HDFC total spent <Amount value={Number(preview.totalSpent)} tone="inherit" />
              </span>
            )}
          </div>
          {previewRows.length > 0 && (
            <ListView
              aria-label="Pasted transactions"
              columns={PREVIEW_COLUMNS}
              rows={previewRows}
              rowKey="index"
              rowClassName={(r) => (r.status === 'new' ? '' : 'unbilled__row--skipped')}
              storageKey="fintrack.cards.unbilled-preview"
            />
          )}
        </>
      )}
      <ErrorMessage message={error} />
    </Dialog>
  );
}
