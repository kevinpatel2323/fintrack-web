import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight, ClipboardCheck, Download, Layers, MoreHorizontal, Pencil, Trash2, UserX,
} from 'lucide-react';
import {
  Alert, Amount, Avatar, Button, Card, ConfirmDialog, Dropdown, EmptyState, PageBody, PageHeader, Skeleton,
  StatCard, TabButtons, Tabs, toast,
} from '../components/ui';
import FriendLedgerExportModal from '../components/FriendLedgerExportModal.jsx';
import SettlementAllocationModal from '../components/SettlementAllocationModal.jsx';
import NetOffModal, { canNetOff } from '../components/NetOffModal.jsx';
import WriteOffModal from '../components/WriteOffModal.jsx';
import LegacyReviewModal from '../components/LegacyReviewModal.jsx';
import { GroupRow, GroupSelectionBar, GroupTitleDialog } from '../components/EntryGroups.jsx';
import PersonDialog from '../components/people/PersonDialog.jsx';
import LedgerRow, { formatDay, isGroupable } from './people/LedgerRow.jsx';
import BalanceChart from './people/BalanceChart.jsx';
import {
  createGroup, deleteGroup, deleteOffset, deleteWriteOff, fetchOffsets, updateGroup,
} from '../services/friendsApi.js';
import { refreshReviewSummary } from '../hooks/useReviewSummary.js';
import { rupees, toMinor } from '../utils/settlementAllocation.js';
import { groupIdOf, groupLedgerRows } from '../utils/entryGroups.js';
import { friendFirstName } from '../utils/ledgerParties.js';
import { API_BASE, apiFetch } from '../services/http.js';
import './FriendDetail.css';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'owe', label: 'You owe' },
  { value: 'owed', label: 'They owe' },
  { value: 'settled', label: 'Settled' },
];

export default function FriendDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [friend, setFriend] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tags, setTags] = useState([]);
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('activity');
  const [status, setStatus] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The settlement whose bill-wise allocation is being edited, if any.
  const [allocatingTag, setAllocatingTag] = useState(null);
  const [writeOffTag, setWriteOffTag] = useState(null);
  const [netOffOpen, setNetOffOpen] = useState(false);
  // People links here with ?review=1 to open the review straight away.
  const [searchParams] = useSearchParams();
  const [reviewOpen, setReviewOpen] = useState(searchParams.get('review') === '1');
  const [offsets, setOffsets] = useState([]);
  // Entry groups: ticking entries to group (or to add to `picking.target`),
  // the title dialog, and the group waiting on "Ungroup?".
  const [picking, setPicking] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [groupDialog, setGroupDialog] = useState(null);
  const [ungrouping, setUngrouping] = useState(null);

  async function load() {
    try {
      const [fRes, sRes, tRes, oRes] = await Promise.all([
        apiFetch(`${API_BASE}/friends/${id}`),
        apiFetch(`${API_BASE}/friends/${id}/summary`),
        apiFetch(`${API_BASE}/friends/${id}/transactions`),
        fetchOffsets(id).catch(() => ({ data: [] })),
      ]);
      if (fRes.ok) { const d = await fRes.json(); setFriend(d.data || d); }
      if (sRes.ok) { const d = await sRes.json(); setSummary(d.data || d); }
      if (tRes.ok) { const d = await tRes.json(); setTags(d.data || []); }
      setOffsets(oRes?.data || []);
      setStatus(fRes.ok ? '' : fRes.status === 404 ? 'missing' : 'Could not load this person.');
    } catch (e) {
      setStatus(e.message || 'Failed to load');
    } finally {
      setLoaded(true);
    }
  }

  // After anything that changes what is settled: reload this page and the
  // review badge on People.
  async function reload() {
    await Promise.all([load(), refreshReviewSummary()]);
  }

  async function undo(action, done) {
    try {
      await action();
      await reload();
      toast(done);
    } catch (e) {
      toast.error(e.message || 'Could not undo.');
    }
  }

  function startPicking(target = null) {
    setView('activity');
    setPicked(new Set());
    setPicking({ target });
  }

  function stopPicking() {
    setPicking(null);
    setPicked(new Set());
  }

  function togglePicked(tagId) {
    setPicked((prev) => {
      const next = new Set(prev);
      const key = String(tagId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function groupAction(action, done) {
    try {
      await action();
      stopPicking();
      await load();
      if (done) toast.success(done);
    } catch (e) {
      toast.error(e.message || 'Could not change the group.');
    }
  }

  function confirmPicked() {
    if (picking?.target) {
      const { target } = picking;
      const n = picked.size;
      groupAction(
        () => updateGroup(id, target.id, { addTagIds: [...picked].map(Number) }),
        `Added ${n} ${n === 1 ? 'entry' : 'entries'} to “${target.title}”`,
      );
    } else {
      setGroupDialog({ mode: 'create', members: tags.filter((t) => picked.has(String(t.id))) });
    }
  }

  // Create and rename both come through the title dialog, which shows the
  // error itself if saving fails.
  async function saveGroupTitle(title) {
    if (groupDialog.mode === 'create') {
      const created = await createGroup(id, title, groupDialog.members.map((t) => t.id));
      stopPicking();
      await load();
      toast.success({
        title: `Grouped ${groupDialog.members.length} entries as “${title}”`,
        action: created?.id
          ? { label: 'Undo', onClick: () => groupAction(() => deleteGroup(id, created.id), 'Group removed') }
          : undefined,
      });
    } else {
      await updateGroup(id, groupDialog.group.id, { title });
      await load();
      toast.success('Group renamed');
    }
  }

  async function deletePerson() {
    const res = await apiFetch(`${API_BASE}/friends/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    toast.success(`${f?.name || 'Person'} deleted`);
    navigate('/friends');
  }

  useEffect(() => {
    setLoaded(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // resilient: friend may be a wrapped object
  const f = friend?.id ? friend : friend?.data || friend;
  const first = friendFirstName(f?.name);

  const owedToMe = Number(summary?.totalOwesMe ?? 0);   // friend owes me (I paid for them)
  const iOwe = Number(summary?.totalIOwe ?? 0);         // I owe friend (they paid for me)
  const settlements = Number(summary?.totalSettlements ?? 0);
  const net = Number(summary?.net ?? (owedToMe - iOwe - settlements));

  // Bill-wise: entry by entry, what is still pending, and settlement money not
  // applied to any entry yet. Entries settled by pre-amount links count as done.
  const openOwesMe = Number(summary?.openOwesMe ?? 0);
  const openIOwe = Number(summary?.openIOwe ?? 0);
  const onAccountReceived = Number(summary?.onAccountReceived ?? summary?.onAccount ?? 0);
  const onAccountPaid = Number(summary?.onAccountPaid ?? 0);
  const legacyDifference = Number(summary?.legacyDifference ?? 0);
  const needingReview = Number(summary?.legacyNeedingReview ?? 0);

  const filtered = useMemo(() => {
    if (filter === 'all') return tags;
    if (filter === 'open') {
      return tags.filter(
        (t) =>
          ((t.direction === 'OWES_ME' || t.direction === 'I_OWE') && Number(t.pendingAmount) > 0) ||
          (t.direction === 'SETTLEMENT' && Number(t.unallocatedAmount) > 0),
      );
    }
    if (filter === 'owe') return tags.filter((t) => t.direction === 'I_OWE');
    if (filter === 'owed') return tags.filter((t) => t.direction === 'OWES_ME');
    if (filter === 'settled') return tags.filter((t) => t.direction === 'SETTLEMENT' || t.direction === 'NOTHING_OUTSTANDING');
    return tags;
  }, [tags, filter]);

  // A group shows when any of its entries passes the filter, always with all
  // of its entries, so what it adds up to is the whole group.
  const rows = useMemo(() => {
    const members = new Map();
    for (const t of tags) {
      const groupId = groupIdOf(t);
      if (groupId) members.set(groupId, [...(members.get(groupId) || []), t]);
    }
    return groupLedgerRows(filtered).map((r) =>
      r.kind === 'group' ? { ...r, members: members.get(r.group.id) } : r,
    );
  }, [tags, filtered]);
  const canGroup = tags.filter(isGroupable).length >= 2;
  const netOffReady = canNetOff(summary);

  // ---------- Not loaded yet / not found ----------
  if (!f) {
    const failed = loaded && status;
    return (
      <>
        <PageHeader
          title={failed ? 'Person' : 'Loading…'}
          breadcrumbs={[{ label: 'People', to: '/friends' }, { label: failed ? 'Not found' : 'Loading…' }]}
          back="/friends"
        />
        <PageBody>
          {failed ? (
            <EmptyState
              icon={UserX}
              title={status === 'missing' ? 'This person doesn’t exist' : 'Could not load this person'}
              description={status === 'missing' ? 'They may have been deleted.' : status}
              action={<Button label="Back to People" to="/friends" />}
            />
          ) : (
            <div className="person-loading" aria-busy="true">
              <div className="person-head">
                <Skeleton circle width={46} height={46} />
                <div className="person-head__text">
                  <Skeleton width={160} height={18} />
                  <Skeleton width={220} height={14} />
                </div>
              </div>
              <div className="person-stats">
                {[0, 1, 2, 3].map((i) => <StatCard key={i} label=" " loading />)}
              </div>
              <Skeleton height={240} />
            </div>
          )}
        </PageBody>
      </>
    );
  }

  // ---------- Actions ----------
  const moreActions = [
    {
      group: undefined,
      items: [
        { label: 'Net off', icon: ArrowLeftRight, onClick: () => setNetOffOpen(true), condition: () => netOffReady },
        { label: 'Review older settlements', icon: ClipboardCheck, onClick: () => setReviewOpen(true), condition: () => needingReview > 0 },
        { label: 'Group entries', icon: Layers, onClick: () => startPicking(), condition: () => canGroup && !picking },
      ],
    },
    {
      group: undefined,
      items: [{ label: 'Edit details', icon: Pencil, onClick: () => setEditOpen(true) }],
    },
    { group: undefined, items: [{ label: 'Delete person', icon: Trash2, theme: 'red', onClick: () => setDeleteOpen(true) }] },
  ];

  const balanceLabel = net > 0 ? `${first} owes you` : net < 0 ? `You owe ${first}` : 'Balance';

  // ---------- Activity ----------
  const ledgerRow = (t, extra = {}) => (
    <LedgerRow
      key={t.id}
      tag={t}
      friendName={f.name}
      picking={Boolean(picking)}
      onAllocate={setAllocatingTag}
      onWriteOff={setWriteOffTag}
      onUndoWriteOff={(writeOffId) => undo(() => deleteWriteOff(id, writeOffId), 'Write-off undone')}
      pick={picking && isGroupable(t) ? { checked: picked.has(String(t.id)), onToggle: () => togglePicked(t.id) } : null}
      {...extra}
    />
  );

  const activityEmpty = tags.length === 0
    ? { title: 'No shared expenses yet', description: `Split a transaction with ${first} and it shows up here.` }
    : {
        open: { title: `Nothing open with ${first}`, description: 'Every entry is settled.' },
        owe: { title: `You don’t owe ${first} for anything`, description: 'Entries where they paid for you show up here.' },
        owed: { title: `${first} doesn’t owe you for anything`, description: 'Entries where you paid for them show up here.' },
        settled: { title: 'No settlements yet', description: 'Payments between you show up here.' },
      }[filter] || { title: 'No entries', description: '' };

  const activityPanel = (
    <div role="tabpanel" id="person-panel-activity" aria-labelledby="person-tab-activity" className="person-panel">
      <div className="person-panel__toolbar">
        <div className="person-panel__filters">
          <TabButtons aria-label="Filter entries" value={filter} onChange={setFilter} options={FILTERS} />
        </div>
        {filtered.length > 0 && (
          <span className="person-panel__count">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState size="sm" title={activityEmpty.title} description={activityEmpty.description} />
      ) : (
        <div className="ledger-list" data-picking={picking ? '' : undefined} aria-label="Ledger entries">
          {rows.map((r) => (r.kind === 'group' ? (
            <GroupRow
              key={`group-${r.group.id}`}
              group={r.group}
              members={r.members}
              friendName={f.name}
              picking={Boolean(picking)}
              onRename={() => setGroupDialog({ mode: 'rename', group: r.group, members: r.members })}
              onAddEntries={() => startPicking(r.group)}
              onUngroup={() => setUngrouping(r.group)}
              renderEntry={(t) => ledgerRow(t, {
                onRemoveFromGroup: () =>
                  groupAction(
                    () => updateGroup(id, r.group.id, { removeTagIds: [Number(t.id)] }),
                    `Taken out of “${r.group.title}”`,
                  ),
              })}
            />
          ) : ledgerRow(r.tag)))}
        </div>
      )}
      {picking && (
        <GroupSelectionBar count={picked.size} target={picking.target} onConfirm={confirmPicked} onCancel={stopPicking} />
      )}
    </div>
  );

  const nettedPanel = (
    <div role="tabpanel" id="person-panel-netted" aria-labelledby="person-tab-netted" className="person-panel">
      {offsets.length === 0 ? (
        <EmptyState
          size="sm"
          title="Nothing netted off"
          description="Net off clears what you owe each other without any money moving."
          action={netOffReady ? <Button label="Net off" onClick={() => setNetOffOpen(true)} /> : null}
        />
      ) : (
        <div className="person-offsets">
          {offsets.map((o) => (
            <div key={o.id} className="person-offset">
              <span className="person-offset__date">{formatDay(o.createdAt)}</span>
              <span className="person-offset__text">
                <span className="person-offset__title">
                  {o.lines.length} {o.lines.length === 1 ? 'entry' : 'entries'} netted off
                </span>
                {o.note && <span className="person-offset__note">{o.note}</span>}
              </span>
              <span className="person-offset__amount">{rupees(toMinor(o.amount))}</span>
              <Button
                variant="ghost"
                label="Undo"
                onClick={() => undo(() => deleteOffset(id, o.id), 'Net off undone')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const contactRows = [
    { label: 'Email', value: f.email, href: f.email ? `mailto:${f.email}` : null },
    { label: 'Phone', value: f.phone, href: f.phone ? `tel:${f.phone}` : null },
    { label: 'Note', value: f.note },
  ];

  return (
    <>
      <PageHeader
        title={f.name}
        breadcrumbs={[{ label: 'People', to: '/friends' }, { label: f.name }]}
        back="/friends"
        actions={
          <>
            <Button variant="solid" iconLeft={Download} label="Export ledger" onClick={() => setExportOpen(true)} />
            <Dropdown placement="bottom-end" options={moreActions}>
              <Button variant="ghost" icon={MoreHorizontal} label="More actions" />
            </Dropdown>
          </>
        }
        mobileActions={
          <>
            <Button variant="ghost" size="md" icon={Download} label="Export ledger" onClick={() => setExportOpen(true)} />
            <Dropdown placement="bottom-end" options={moreActions}>
              <Button variant="ghost" size="md" icon={MoreHorizontal} label="More actions" />
            </Dropdown>
          </>
        }
      />

      <PageBody className="person-page">
        <div className="person-layout">
          <div className="person-main">
            <header className="person-head">
              <Avatar label={f.name} size="3xl" aria-hidden />
              <div className="person-head__text">
                <h2 className="person-head__name">{f.name}</h2>
                <p className="person-head__contact">
                  {[f.email, f.phone].filter(Boolean).join(' · ') || 'No email or phone'}
                </p>
              </div>
            </header>

            {needingReview > 0 && (
              <Alert
                theme="amber"
                title={`${needingReview} older ${needingReview === 1 ? 'settlement doesn’t' : 'settlements don’t'} match ${
                  needingReview === 1 ? 'its' : 'their'
                } entries`}
                description="They were saved before Fintrack recorded amounts. Review them so the balance is right."
                primaryAction={{ label: 'Review', onClick: () => setReviewOpen(true) }}
              />
            )}

            <div className="person-stats">
              <StatCard
                label={balanceLabel}
                value={<Amount value={Math.abs(net)} tone="inherit" />}
                hint={net === 0 ? 'All settled' : undefined}
                loading={!summary}
              />
              <StatCard label={`${first} paid`} value={<Amount value={iOwe} tone="inherit" />} loading={!summary} />
              <StatCard label="You paid" value={<Amount value={owedToMe} tone="inherit" />} loading={!summary} />
              <StatCard label="Settled" value={<Amount value={settlements} tone="inherit" />} loading={!summary} />
            </div>

            <OpenDuesLine
              first={first}
              openOwesMe={openOwesMe}
              openIOwe={openIOwe}
              onAccountReceived={onAccountReceived}
              onAccountPaid={onAccountPaid}
              legacyDifference={legacyDifference}
              onReview={() => setReviewOpen(true)}
              onNetOff={netOffReady ? () => setNetOffOpen(true) : null}
            />

            <div className="person-tabs">
              <Tabs
                idPrefix="person"
                aria-label={`${f.name} ledger`}
                value={view}
                onChange={setView}
                tabs={[
                  { label: 'Activity', value: 'activity', count: tags.length },
                  { label: 'Netted off', value: 'netted', count: offsets.length },
                ]}
              />
              {view === 'netted' ? nettedPanel : activityPanel}
            </div>
          </div>

          <aside className="person-side" aria-label="Details">
            <Card title="Balance over time" description={`Above zero, ${first} owes you`}>
              <BalanceChart tags={tags} friendFirst={first} />
            </Card>
            <Card
              title="Contact details"
              actions={<Button variant="ghost" icon={Pencil} label="Edit details" onClick={() => setEditOpen(true)} />}
            >
              <dl className="person-fields">
                {contactRows.map((row) => (
                  <div key={row.label} className="person-field">
                    <dt className="person-field__label">{row.label}</dt>
                    <dd className="person-field__value">
                      {row.value ? (
                        row.href ? <a className="person-field__link" href={row.href}>{row.value}</a> : row.value
                      ) : (
                        <span className="text-ink-gray-4">Not added</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </aside>
        </div>
      </PageBody>

      <FriendLedgerExportModal friend={f} open={exportOpen} onClose={() => setExportOpen(false)} />
      {allocatingTag && (
        <SettlementAllocationModal
          tag={allocatingTag}
          friendName={f.name}
          onClose={() => setAllocatingTag(null)}
          onSaved={reload}
        />
      )}
      {writeOffTag && (
        <WriteOffModal friendId={id} tag={writeOffTag} onClose={() => setWriteOffTag(null)} onSaved={reload} />
      )}
      {netOffOpen && (
        <NetOffModal friendId={id} friendName={f.name} onClose={() => setNetOffOpen(false)} onSaved={reload} />
      )}
      {reviewOpen && (
        <LegacyReviewModal friendId={id} friendName={f.name} onClose={() => setReviewOpen(false)} onSaved={reload} />
      )}
      {groupDialog && (
        <GroupTitleDialog
          mode={groupDialog.mode}
          initialTitle={groupDialog.group?.title}
          members={groupDialog.members}
          friendName={f.name}
          onClose={() => setGroupDialog(null)}
          onSubmit={saveGroupTitle}
        />
      )}
      <PersonDialog open={editOpen} person={f} onClose={() => setEditOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(ungrouping)}
        title={`Ungroup “${ungrouping?.title}”?`}
        message="Its entries go back to being listed one by one. Nothing about the balance changes."
        confirmLabel="Ungroup"
        theme="gray"
        onConfirm={() => {
          const group = ungrouping;
          setUngrouping(null);
          groupAction(() => deleteGroup(id, group.id), `Ungrouped “${group.title}”`);
        }}
        onCancel={() => setUngrouping(null)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${f.name}?`}
        message="This removes the person and unlinks any tagged transactions."
        confirmLabel="Delete"
        onConfirm={deletePerson}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

/**
 * How the balance splits up entry by entry: what is open on each side, money
 * on account, and whatever only older amount-less settlements explain — so
 * the pieces always add back up to the balance above. Offers the next step
 * where there is one: net the two open sides off, or review.
 */
function OpenDuesLine({
  first, openOwesMe, openIOwe, onAccountReceived, onAccountPaid, legacyDifference, onReview, onNetOff,
}) {
  const parts = [
    openOwesMe > 0 ? `${first} has ${rupees(toMinor(openOwesMe))} open` : null,
    openIOwe > 0 ? `you have ${rupees(toMinor(openIOwe))} open` : null,
    onAccountReceived > 0 ? `${rupees(toMinor(onAccountReceived))} of ${first}'s money on account` : null,
    onAccountPaid > 0 ? `${rupees(toMinor(onAccountPaid))} of your money on account` : null,
  ].filter(Boolean);
  const legacy = toMinor(legacyDifference);
  if (parts.length === 0 && legacy === 0) return null;
  return (
    <div className="person-dues">
      <p className="person-dues__text">
        {parts.length > 0 && <>Entry by entry: {parts.join(' · ')}</>}
        {legacy !== 0 && (
          <>
            {parts.length > 0 && ' · '}
            <span className="person-dues__warn">
              {rupees(Math.abs(legacy))} from older settlements that don&apos;t match their entries
            </span>
          </>
        )}
      </p>
      <div className="person-dues__actions">
        {onNetOff && <Button size="sm" variant="subtle" iconLeft={ArrowLeftRight} label="Net off" onClick={onNetOff} />}
        {legacy !== 0 && <Button size="sm" variant="subtle" label="Review" onClick={onReview} />}
      </div>
    </div>
  );
}
