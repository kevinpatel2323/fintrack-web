import { useMemo, useState } from 'react';
import { MoreHorizontal, Pin, PinOff, RotateCw, Search, SearchX } from 'lucide-react';
import {
  Amount, Button, Checkbox, Dropdown, EmptyState, ErrorMessage, Select, Skeleton, TextInput,
} from '../ui';
import { ledgerDate, ledgerDirectionPhrase, ledgerNumber, ledgerRowAmount } from '../../utils/ledgerParties';

const SORTS = [
  { label: 'Oldest first', value: 'date-asc' },
  { label: 'Newest first', value: 'date-desc' },
  { label: 'Largest amount', value: 'amount-desc' },
  { label: 'By group', value: 'group' },
];

function dateOf(tag) {
  return tag.transaction?.transactionDate || '';
}

function amountOf(tag) {
  return Number(ledgerRowAmount(tag)) || 0;
}

// The payee first, as the transaction list shows it; the UPI description is
// often just "UPI".
function descriptionOf(tag) {
  const t = tag.transaction || {};
  return t.upiName || t.upiDescription || t.narration || 'Transaction';
}

function sortTags(tags, sort) {
  const list = [...tags];
  switch (sort) {
    case 'date-desc':
      return list.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
    case 'amount-desc':
      return list.sort((a, b) => amountOf(b) - amountOf(a));
    case 'group':
      // Grouped entries together by group name; ungrouped ones after them.
      return list.sort((a, b) => {
        const ga = a.entryGroup?.title || '';
        const gb = b.entryGroup?.title || '';
        if (!ga !== !gb) return ga ? -1 : 1;
        return ga.localeCompare(gb) || dateOf(a).localeCompare(dateOf(b));
      });
    default:
      return list.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  }
}

/** A lucide pin, filled, for a row whose choice is saved. */
function PinFilled(props) {
  return <Pin {...props} fill="currentColor" />;
}

function PickerRow({ tag, friendName, selected, pinned, onToggle, onTogglePin }) {
  const id = `lx-include-${tag.id}`;
  const amount = amountOf(tag);
  const meta = [
    ledgerDate(dateOf(tag)),
    ledgerDirectionPhrase(tag.direction, friendName),
    tag.entryGroup?.title,
    pinned ? (selected ? 'Always included' : 'Always excluded') : null,
  ].filter(Boolean);
  const pinLabel = pinned
    ? `Always ${selected ? 'included' : 'excluded'}. Click to forget this choice`
    : 'Remember this choice for future exports';

  return (
    <li className={`lx-pick${selected ? '' : ' is-excluded'}`}>
      <Checkbox id={id} checked={selected} onChange={() => onToggle(tag.id)} />
      <label htmlFor={id} className="lx-pick__text">
        <span className="lx-pick__title truncate">{descriptionOf(tag)}</span>
        <span className="lx-pick__meta truncate">{meta.join(' · ')}</span>
      </label>
      <span className="lx-pick__amount">
        <Amount value={amount} sign="never" tone="inherit" decimals={Number.isInteger(amount) ? 0 : 2} />
      </span>
      <Button
        variant="ghost"
        icon={pinned ? PinFilled : Pin}
        label={pinLabel}
        tooltip={pinLabel}
        active={pinned}
        aria-pressed={pinned}
        className="lx-pick__pin"
        onClick={() => onTogglePin(tag.id)}
      />
    </li>
  );
}

/**
 * Which ledger rows go into the export. Ticks apply to this export; a pin
 * saves the row's current choice for every future export of this person's
 * ledger. Rows of one entry group tick and pin together (the caller handles
 * that), since the group prints as one row.
 */
export default function LedgerRowPicker({
  tags,
  friendName,
  selectedIds,
  pinnedIds,
  status,
  error,
  onRetry,
  onToggle,
  onTogglePin,
  onSelectAll,
  onSelectNone,
  onRememberAll,
  onForgetAll,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date-asc');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tags.filter((tag) => {
          const t = tag.transaction || {};
          const haystack = [
            ledgerDate(dateOf(tag)),
            tag.entryGroup?.title,
            ledgerDirectionPhrase(tag.direction, friendName),
            ledgerNumber(ledgerRowAmount(tag)),
            t.upiName,
            t.upiDescription || t.narration,
            tag.note,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(q);
        })
      : tags;
    return sortTags(filtered, sort);
  }, [tags, query, sort, friendName]);

  const total = tags.length;
  const included = selectedIds.size;
  const allIncluded = total > 0 && included === total;

  let body;
  if (status === 'error') {
    body = (
      <div className="lx-picker__state">
        <ErrorMessage message={error || 'Could not load transactions.'} />
        <Button iconLeft={RotateCw} label="Try again" onClick={onRetry} />
      </div>
    );
  } else if (status === 'loading' && !total) {
    body = (
      <ul className="lx-picker__list" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="lx-pick lx-pick--skeleton">
            <Skeleton width={14} height={14} />
            <span className="lx-pick__text">
              <Skeleton height={12} width="70%" />
              <Skeleton height={10} width="45%" />
            </span>
          </li>
        ))}
      </ul>
    );
  } else if (status === 'idle') {
    body = <p className="lx-picker__hint">Pick a statement period to load transactions.</p>;
  } else if (!total) {
    body = (
      <EmptyState size="sm" icon={SearchX} title="No transactions in this range" description="Try a longer statement period." />
    );
  } else {
    body = (
      <>
        <div className="lx-picker__filters">
          <TextInput
            className="lx-picker__search"
            type="search"
            prefix={Search}
            placeholder="Search"
            aria-label="Search transactions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            className="lx-picker__sort"
            aria-label="Sort transactions"
            options={SORTS}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          />
        </div>

        <div className="lx-picker__all">
          <Checkbox
            label={`Include all ${total}`}
            checked={allIncluded}
            indeterminate={included > 0 && !allIncluded}
            onChange={() => (allIncluded ? onSelectNone() : onSelectAll())}
          />
          <Dropdown
            placement="bottom-end"
            options={[
              {
                items: [
                  {
                    label: 'Remember all choices',
                    icon: Pin,
                    disabled: !total || pinnedIds.size === total,
                    onClick: onRememberAll,
                  },
                  {
                    label: 'Forget saved choices',
                    icon: PinOff,
                    disabled: !pinnedIds.size,
                    onClick: onForgetAll,
                  },
                ],
              },
            ]}
          >
            <Button variant="ghost" icon={MoreHorizontal} label="Saved choices" />
          </Dropdown>
        </div>

        {visible.length ? (
          <ul className="lx-picker__list" aria-label="Transactions to include" aria-busy={status === 'loading' || undefined}>
            {visible.map((tag) => {
              const key = String(tag.id);
              return (
                <PickerRow
                  key={key}
                  tag={tag}
                  friendName={friendName}
                  selected={selectedIds.has(key)}
                  pinned={pinnedIds.has(key)}
                  onToggle={onToggle}
                  onTogglePin={onTogglePin}
                />
              );
            })}
          </ul>
        ) : (
          <EmptyState
            size="sm"
            icon={Search}
            title="No transactions match your search"
            action={<Button label="Clear search" onClick={() => setQuery('')} />}
          />
        )}
      </>
    );
  }

  return (
    <section className="lx-picker" aria-labelledby="lx-picker-title">
      <div className="lx-picker__head">
        <h3 id="lx-picker-title" className="lx-section-title">Transactions</h3>
        {total > 0 && (
          <span className="lx-picker__count text-sm">
            {included} of {total} included{pinnedIds.size > 0 ? ` · ${pinnedIds.size} saved` : ''}
          </span>
        )}
      </div>
      <p className="lx-picker__hint">
        Ticks apply to this export only. Pin a row to keep its choice for every future export of {friendName}'s ledger.
      </p>
      {body}
    </section>
  );
}
