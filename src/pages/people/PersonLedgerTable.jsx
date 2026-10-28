import { useMemo, useState } from 'react';
import {
  ChevronRight, Eraser, FolderMinus, ListChecks, ListPlus, MoreHorizontal, Pencil, Undo2,
} from 'lucide-react';
import { Amount, Badge, Button, Checkbox, Dropdown, ListView } from '../../components/ui';
import { groupTotals } from '../../utils/entryGroups.js';
import { friendFirstName } from '../../utils/ledgerParties.js';
import { rupees, toMinor } from '../../utils/settlementAllocation.js';
import { useIsCompact } from '../../styles/breakpoints.js';
import { entryFacts, formatDay, formatDayShort, hasPaise, isGroupable } from './ledgerEntry.js';
import './PersonLedgerTable.css';

const GROUP_STATUS = { open: 'Open', partial: 'Partly settled', settled: 'Settled' };
const NOTE_THEME = { ok: 'green', warn: 'amber' };

const cx = (...parts) => parts.filter(Boolean).join(' ');
const stop = (e) => e.stopPropagation();

/** Entries and groups as table rows. A group's entries are its sub-rows. */
function toItems(rows, expanded) {
  return rows.map((r) => (r.kind === 'group'
    ? { key: `g${r.group.id}`, kind: 'group', group: r.group, members: r.members, open: expanded.has(r.group.id) }
    : { key: `t${r.tag.id}`, kind: 'entry', tag: r.tag }));
}

/** An open group's entries, shown under it (they follow it through sorting and paging). */
function memberRows(item) {
  if (item.kind !== 'group' || !item.open) return null;
  return item.members.map((tag, i) => ({
    key: `m${tag.id}`, kind: 'member', tag, group: item.group, last: i === item.members.length - 1,
  }));
}

const dayOf = (value) => (value ? String(value).slice(0, 10) : '');

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
 * Direction, Status, Amount, and a row menu; sortable, resizable and paged
 * like every ListView. Entry groups are one row with the entries' net total
 * and expand in place, like card bills do on Transactions. While entries are
 * being picked for a group, a checkbox column appears and a row click ticks
 * it; otherwise a row opens its transaction. Rows start in ledger order.
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
  const items = useMemo(() => toItems(rows, expanded), [rows, expanded]);
  const first = friendFirstName(friendName);
  // Phones (ListView's row layout): Date, Direction and Status fold into a
  // line under the entry, and a settlement's "Apply" moves to its … menu.
  const phone = useIsCompact();
  const foldBelow = phone ? 'md' : 'sm';

  const toggleGroup = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const entryMenu = (item, facts) => {
    const { tag } = item;
    return [
      facts.isSettlement && onAllocate && (!facts.applyInline || phone)
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
      minWidth: 88,
      hideBelow: foldBelow,
      sortable: true,
      sortFirst: 'desc',
      sortValue: (item) => (item.kind === 'group'
        ? dayOf(groupTotals(item.members).dateFrom)
        : dayOf(item.tag.transaction?.transactionDate)),
      render: (item) => {
        if (item.kind === 'group') return <span className="pledger-date">{formatDay(groupTotals(item.members).dateFrom)}</span>;
        return <span className="pledger-date">{entryFacts(item.tag, friendName).date}</span>;
      },
    },
    {
      key: 'entry',
      label: 'Entry',
      // Floors sized so Entry, Amount and the menu fit a 390px phone.
      width: 'minmax(160px, 3fr)',
      flex: true,
      sortable: true,
      sortValue: (item) => (item.kind === 'group' ? item.group.title : entryFacts(item.tag, friendName).title),
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
                {phone && <span className="pledger-entry__meta">{groupMeta(totals)}</span>}
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
                {(phone
                  // Status before direction: the signed amount already says which way.
                  ? [formatDayShort(item.tag.transaction?.transactionDate), ...facts.notes.map((n) => n.text), facts.words]
                  : [facts.date, facts.words, ...facts.notes.map((n) => n.text)]
                ).join(' · ')}
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
      hideBelow: foldBelow,
      sortable: true,
      sortValue: (item) => {
        if (item.kind !== 'group') return entryFacts(item.tag, friendName).words;
        const net = toMinor(groupTotals(item.members).totalAmount);
        return net > 0 ? `${first} owes you` : net < 0 ? `You owe ${first}` : 'Nets to nothing';
      },
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
      sortable: true,
      sortValue: (item) => (item.kind === 'group'
        ? GROUP_STATUS[groupTotals(item.members).status]
        : entryFacts(item.tag, friendName).notes.map((n) => n.text).join(' ')),
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
      // Phones: as wide as the figure, so the entry keeps the room.
      width: phone ? 'auto' : 112,
      minWidth: 96,
      align: 'right',
      sortable: true,
      sortValue: (item) => (item.kind === 'group'
        ? Number(groupTotals(item.members).totalAmount) || 0
        : entryFacts(item.tag, friendName).signed),
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
            {/* On phones the menu is an action sheet, titled with the row. */}
            <Dropdown placement="bottom-end" options={options} label={phone ? name : undefined}>
              <Button variant="ghost" icon={MoreHorizontal} label={`Actions for ${name}`} />
            </Dropdown>
          </span>
        );
      },
    },
  ].filter(Boolean);

  // The group's dates, which way it nets and where it stands, for its phone line.
  function groupMeta(totals) {
    const net = toMinor(totals.totalAmount);
    const from = formatDayShort(totals.dateFrom);
    const to = formatDayShort(totals.dateTo);
    return [
      totals.dateFrom && totals.dateTo && from !== to ? `${from} – ${to}` : from,
      GROUP_STATUS[totals.status],
      net > 0 ? `${first} owes you` : net < 0 ? `You owe ${first}` : 'Nets to nothing',
    ].join(' · ');
  }

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
      className={cx('pledger', picking && 'is-picking', phone && 'phone-bleed')}
      aria-label="Ledger entries"
      columns={columns}
      rows={items}
      rowKey="key"
      subRows={memberRows}
      storageKey="fintrack.person-ledger"
      pagination
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
