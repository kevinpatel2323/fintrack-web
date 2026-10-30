import { ArrowUpRight, MoreHorizontal, RotateCw, Trash2 } from 'lucide-react';
import { Button, Dropdown, useListSettings } from '../../components/ui';
import MemoCell from './MemoCell.jsx';
import { MemoAmount, MemoTile, UnverifiedBadge } from './memoParts.jsx';
import {
  fmtMemoDay, fmtMemoTime, memoAccount, memoAmountSortValue, memoDateSortValue, memoDay, memoMethod, memoPayee,
  memoTime,
} from './memoModel.js';

/**
 * The memo columns on the kit ListView, in TransactionTable's terms: widths,
 * sort values and which columns drop out on narrower screens. Payee is the
 * flexible title column; every named column sorts; Date and Amount start
 * descending (Amount by spend, as on Transactions).
 */
function columnSpecs(accountNames) {
  return [
    {
      key: 'date', label: 'Date', width: 88, minWidth: 72, sortFirst: 'desc', sortValue: memoDateSortValue,
    },
    {
      key: 'payee', label: 'Payee', width: 240, minWidth: 200, flex: true, pinned: true,
      sortValue: (m) => memoPayee(m).toLowerCase(),
    },
    {
      key: 'memo', label: 'Memo', width: 260, minWidth: 140,
      sortValue: (m) => (typeof m.memo === 'string' ? m.memo.trim().toLowerCase() : ''),
    },
    {
      key: 'method', label: 'Method', width: 128, minWidth: 88, hideBelow: 'lg',
      sortValue: (m) => memoMethod(m) || '',
    },
    {
      key: 'account', label: 'Account', width: 136, minWidth: 96, hideBelow: 'lg',
      sortValue: (m) => memoAccount(m, accountNames) || '',
    },
    {
      key: 'amount', label: 'Amount', width: 120, minWidth: 96, align: 'right', sortFirst: 'desc',
      sortValue: memoAmountSortValue,
    },
  ];
}

const BASE_SPECS = columnSpecs();
const PINNED = [...BASE_SPECS.filter((c) => c.pinned).map((c) => c.key), 'actions'];

export const MEMO_DEFAULT_SORT = { key: 'date', direction: 'desc' };

/** Column choices for the list; pass the result to both the table and its Columns menu. */
export function useMemoColumns() {
  return useListSettings('fintrack.memos.columns', { pinned: PINNED, defaultHidden: [] });
}

/** Hideable columns as `[{ id, label }]`, for the toolbar's Columns menu. */
export function memoColumnChoices() {
  return BASE_SPECS.filter((c) => !c.pinned).map((c) => ({ id: c.key, label: c.label }));
}

function PayeeCell({ memo }) {
  const payee = memoPayee(memo);
  return (
    <div className="memos-payee">
      <span className="memos-payee__name truncate" title={payee}>{payee}</span>
      {memo.senderVerified === false && <UnverifiedBadge />}
    </div>
  );
}

/** The row's `…`: Open, Re-parse, and Delete (red, confirmed by the page). */
function RowMenu({ memo, onOpen, onReparse, onDelete }) {
  return (
    <Dropdown
      placement="bottom-end"
      label="Memo actions"
      options={[
        {
          items: [
            { label: 'Open', icon: ArrowUpRight, onClick: () => onOpen(memo) },
            { label: 'Re-parse', icon: RotateCw, onClick: () => onReparse(memo) },
          ],
        },
        { items: [{ label: 'Delete', icon: Trash2, theme: 'red', onClick: () => onDelete(memo) }] },
      ]}
    >
      <Button
        variant="ghost"
        icon={MoreHorizontal}
        label={`Actions for ${memoPayee(memo)}`}
        className="memos-row-menu"
      />
    </Dropdown>
  );
}

const empty = <span className="memos-empty">—</span>;

/**
 * The desktop table's columns. `accountNames` (from `useAccountNames()`) shows
 * a bank account by its holder's name. `onSaveMemo(memo, text|null)` saves an
 * inline edit and rejects on failure; the row menu calls `onOpen`,
 * `onReparse` and `onDelete` with the memo.
 */
export function desktopMemoColumns({ accountNames, onSaveMemo, onOpen, onReparse, onDelete }) {
  const render = {
    date: (m) => {
      const time = memoTime(m);
      return (
        <span className="memos-date" title={time ? `Received ${fmtMemoTime(time)}` : undefined}>
          {fmtMemoDay(memoDay(m))}
        </span>
      );
    },
    payee: (m) => <PayeeCell memo={m} />,
    memo: (m) => <MemoCell row={m} onSave={onSaveMemo} />,
    method: (m) => {
      const method = memoMethod(m);
      return method ? <span className="memos-muted truncate">{method}</span> : empty;
    },
    account: (m) => {
      const account = memoAccount(m, accountNames);
      return account ? <span className="memos-muted truncate" title={account}>{account}</span> : empty;
    },
    amount: (m) => <MemoAmount memo={m} />,
  };

  return [
    ...columnSpecs(accountNames).map((spec) => ({
      ...spec,
      sortable: true,
      className: `memos-cell memos-cell--${spec.key}`,
      render: render[spec.key],
    })),
    {
      key: 'actions',
      label: '',
      width: 36,
      align: 'right',
      pinned: true,
      className: 'memos-cell memos-cell--actions',
      render: (m) => <RowMenu memo={m} onOpen={onOpen} onReparse={onReparse} onDelete={onDelete} />,
    },
  ];
}

/** The phone row's title: tile, payee, and "29 Oct · HDFC ••6714 · memo" (or "Add memo"). */
function PhoneTitle({ memo, accountNames }) {
  const payee = memoPayee(memo);
  const facts = [fmtMemoDay(memoDay(memo)), memoAccount(memo, accountNames)].filter((f) => f && f !== '—');
  const text = typeof memo.memo === 'string' ? memo.memo.trim() : '';
  return (
    <span className="memos-m-row">
      <MemoTile memo={memo} />
      <span className="memos-m-row__text">
        <span className="memos-m-row__title">
          <span className="memos-m-row__payee">{payee}</span>
          {memo.senderVerified === false && <UnverifiedBadge />}
        </span>
        <span className="memos-m-row__meta">
          {facts.length > 0 && `${facts.join(' · ')} · `}
          {text ? <span className="memos-m-row__memo">{text}</span> : <span className="memos-m-row__add">Add memo</span>}
        </span>
      </span>
    </span>
  );
}

/**
 * Phones (FriendsPhone's pattern): the payee with its facts folded into a
 * second line, and the amount. The other columns stay, hidden, only so the
 * "Sorted by …" sheet can order by them.
 */
export function phoneMemoColumns(accountNames) {
  return columnSpecs(accountNames).map((spec) => {
    const base = { key: spec.key, label: spec.label, sortable: true, sortFirst: spec.sortFirst, sortValue: spec.sortValue };
    if (spec.key === 'payee') {
      return {
        ...base,
        width: 'minmax(0, 1fr)',
        flex: true,
        render: (m) => <PhoneTitle memo={m} accountNames={accountNames} />,
      };
    }
    if (spec.key === 'amount') {
      return { ...base, width: 'auto', align: 'right', render: (m) => <MemoAmount memo={m} className="memos-m-amount" /> };
    }
    return { ...base, width: 120, hideBelow: 'md', render: () => null };
  });
}
