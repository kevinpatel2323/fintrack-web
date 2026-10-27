import { useMemo, useState } from 'react';
import {
  ChevronRight, Eraser, FolderMinus, ListChecks, ListPlus, MoreHorizontal, Pencil, Undo2,
} from 'lucide-react';
import { Amount, Badge, Button, Checkbox, Dropdown, ListView } from '../../components/ui';
import { groupTotals } from '../../utils/entryGroups.js';
import { friendFirstName } from '../../utils/ledgerParties.js';
import { rupees, toMinor } from '../../utils/settlementAllocation.js';
import { entryFacts, formatDay, hasPaise, isGroupable } from './ledgerEntry.js';
import './PersonLedgerTable.css';

const GROUP_STATUS = { open: 'Open', partial: 'Partly settled', settled: 'Settled' };
const NOTE_THEME = { ok: 'green', warn: 'amber' };

const cx = (...parts) => parts.filter(Boolean).join(' ');
const stop = (e) => e.stopPropagation();

/** Entries and groups as table rows; an expanded group's entries follow it. */
function flatten(rows, expanded) {
  const items = [];
  for (const r of rows) {
    if (r.kind === 'group') {
      const open = expanded.has(r.group.id);
      items.push({ key: `g${r.group.id}`, kind: 'group', group: r.group, members: r.members, open });
      if (open) {
        r.members.forEach((tag, i) => items.push({
          key: `m${tag.id}`, kind: 'member', tag, group: r.group, last: i === r.members.length - 1,
        }));
      }
    } else {
      items.push({ key: `t${r.tag.id}`, kind: 'entry', tag: r.tag });
    }
  }
  return items;
}

function StatusCell({ notes, applyInline, applyLabel, onApply }) {
  if (!notes.length && !applyInline) return <span className="pledger-muted">—</span>;
  return (
    <span className="pledger-status">
      {notes.map((n) => (
        <Badge key={n.text} size="sm" theme={NOTE_THEME[n.tone] || 'gray'} label={n.text} />
      ))}
      {applyInline && (
        <span className="pledger-status__action" onClick={stop}>
          <Button size="xs" variant="subtle" label={applyLabel} onClick={onApply} />
        </span>
      )}
    </span>
  );
}

/**
 * A person's ledger in the same table as Transactions: Date, Entry,
 * Direction, Status, Amount, and a row menu. Entry groups are one row with
 * the entries' net total and expand in place, like card bills do on
 * Transactions. While entries are being picked for a group, a checkbox column
 * appears and a row click ticks it; otherwise a row opens its transaction.
 */
export default function PersonLedgerTable({
  rows,
  friendName,
  picking = false,
  picked,
  onTogglePick,
  onOpenTransaction,
  onAllocate,
  onWriteOff,
  onUndoWriteOff,
  onRemoveFromGroup,
  onRenameGroup,
  onAddToGroup,
  onUngroup,
}) {
  const [expanded, setExpanded] = useState(() => new Set());
  const items = useMemo(() => flatten(rows, expanded), [rows, expanded]);
  const first = friendFirstName(friendName);

  const toggleGroup = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const entryMenu = (item, facts) => {
    const { tag } = item;
    return [
      facts.isSettlement && onAllocate && !facts.applyInline
        ? { label: facts.applyLabel, icon: ListChecks, onClick: () => onAllocate(tag) }
        : null,
      facts.leftover > 0 && onWriteOff
        ? { label: `Write off ${rupees(facts.leftover)}`, icon: Eraser, onClick: () => onWriteOff(tag) }
        : null,
      ...(onUndoWriteOff
        ? (tag.writeOffs || []).map((w) => ({
          label: `Undo ${rupees(toMinor(w.amount))} write-off`,
          icon: Undo2,
          onClick: () => onUndoWriteOff(w.id),
        }))
        : []),
      item.kind === 'member' && onRemoveFromGroup
        ? { label: 'Take out of group', icon: FolderMinus, onClick: () => onRemoveFromGroup(item.group, tag) }
        : null,
    ].filter(Boolean);
  };

  const columns = [
    picking && {
      key: 'pick',
      label: '',
      width: 36,
      render: (item) => (item.kind !== 'group' && isGroupable(item.tag) ? (
        <span onClick={stop}>
          <Checkbox
            checked={picked.has(String(item.tag.id))}
            onChange={() => onTogglePick(item.tag.id)}
            aria-label={`Select ${entryFacts(item.tag, friendName).title}`}
          />
        </span>
      ) : null),
    },
    {
      key: 'date',
      label: 'Date',
      width: 112,
      hideBelow: 'sm',
      render: (item) => {
        if (item.kind === 'group') return <span className="pledger-date">{formatDay(groupTotals(item.members).dateFrom)}</span>;
        return <span className="pledger-date">{entryFacts(item.tag, friendName).date}</span>;
      },
    },
    {
      key: 'entry',
      label: 'Entry',
      width: 'minmax(200px, 3fr)',
      render: (item) => {
        if (item.kind === 'group') {
          const totals = groupTotals(item.members);
          return (
            <span className="pledger-entry">
              <span className={cx('pledger-chevron', item.open && 'is-open')} aria-hidden>
                <ChevronRight size={16} strokeWidth={1.5} />
              </span>
              <span className="pledger-entry__text">
                <span className="pledger-entry__title">
                  <span className="truncate">{item.group.title}</span>
                  <Badge size="sm" label={`${totals.count} ${totals.count === 1 ? 'entry' : 'entries'}`} />
                </span>
              </span>
            </span>
          );
        }
        const facts = entryFacts(item.tag, friendName);
        return (
          <span className={cx('pledger-entry', item.kind === 'member' && 'pledger-entry--member')}>
            <span className="pledger-entry__text">
              <span className="pledger-entry__title">
                <span className="truncate">{facts.title}</span>
              </span>
              {/* Phones drop Date, Direction and Status; they move here. */}
              <span className="pledger-entry__meta">
                {[facts.date, facts.words, ...facts.notes.map((n) => n.text)].join(' · ')}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: 'direction',
      label: 'Direction',
      width: 180,
      hideBelow: 'sm',
      render: (item) => {
        if (item.kind === 'group') {
          const net = toMinor(groupTotals(item.members).totalAmount);
          return <span className="pledger-muted">{net > 0 ? `${first} owes you` : net < 0 ? `You owe ${first}` : 'Nets to nothing'}</span>;
        }
        return <span className="pledger-muted">{entryFacts(item.tag, friendName).words}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: 'minmax(160px, 1.5fr)',
      hideBelow: 'md',
      render: (item) => {
        if (item.kind === 'group') {
          const totals = groupTotals(item.members);
          return (
            <Badge
              size="sm"
              theme={totals.status === 'settled' ? 'green' : totals.status === 'partial' ? 'amber' : 'gray'}
              label={GROUP_STATUS[totals.status]}
            />
          );
        }
        const facts = entryFacts(item.tag, friendName);
        return (
          <StatusCell
            notes={facts.notes}
            applyInline={facts.applyInline && Boolean(onAllocate)}
            applyLabel={facts.applyLabel}
            onApply={() => onAllocate(item.tag)}
          />
        );
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 128,
      align: 'right',
      render: (item) => {
        if (item.kind === 'group') {
          const total = groupTotals(item.members).totalAmount;
          return <Amount value={total} sign="always" decimals={toMinor(total) % 100 ? 2 : 0} />;
        }
        const facts = entryFacts(item.tag, friendName);
        return facts.nothing
          ? <Amount value={facts.plainAmount} tone="muted" />
          : <Amount value={facts.signed} sign="always" decimals={hasPaise(facts.signed) ? 2 : 0} />;
      },
    },
    {
      key: 'menu',
      label: '',
      width: 44,
      align: 'right',
      render: (item) => {
        const options = item.kind === 'group'
          ? [
            { label: 'Rename', icon: Pencil, onClick: () => onRenameGroup(item.group, item.members) },
            { label: 'Add entries', icon: ListPlus, onClick: () => onAddToGroup(item.group) },
            { label: 'Ungroup', icon: FolderMinus, onClick: () => onUngroup(item.group) },
          ]
          : entryMenu(item, entryFacts(item.tag, friendName));
        if (!options.length) return null;
        const name = item.kind === 'group' ? item.group.title : entryFacts(item.tag, friendName).title;
        return (
          <span className="pledger-menu" onClick={stop}>
            <Dropdown placement="bottom-end" options={options}>
              <Button variant="ghost" icon={MoreHorizontal} label={`Actions for ${name}`} />
            </Dropdown>
          </span>
        );
      },
    },
  ].filter(Boolean);

  const onRowClick = (item) => {
    if (item.kind === 'group') {
      toggleGroup(item.group.id);
      return;
    }
    if (picking) {
      if (isGroupable(item.tag)) onTogglePick(item.tag.id);
      return;
    }
    onOpenTransaction?.(item.tag);
  };

  return (
    <ListView
      className={cx('pledger', picking && 'is-picking')}
      aria-label="Ledger entries"
      columns={columns}
      rows={items}
      rowKey="key"
      onRowClick={onRowClick}
      rowClassName={(item) => cx(
        `pledger-row--${item.kind}`,
        item.last && 'is-last',
        item.kind === 'group' && item.open && 'is-open',
        picking && item.kind !== 'group' && picked.has(String(item.tag.id)) && 'is-picked',
      )}
    />
  );
}
