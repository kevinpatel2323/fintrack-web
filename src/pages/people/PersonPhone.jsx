import { ArrowLeftRight, ClipboardCheck, Download, MoreHorizontal, Undo2 } from 'lucide-react';
import {
  Amount, Avatar, Button, Dropdown, EmptyState, MobileActionBar, MobileField, MobileList, MobileListItem,
  MobileSection, PageBody, Skeleton, TabButtons, Tabs, PageHeader,
} from '../../components/ui';
import { GroupSelectionActionBar } from '../../components/EntryGroups.jsx';
import { rupees, toMinor } from '../../utils/settlementAllocation.js';
import PersonLedgerTable from './PersonLedgerTable.jsx';
import BalanceChart from './BalanceChart.jsx';
import { formatDayShort, legacyDuesText } from './ledgerEntry.js';

/**
 * A person on a phone: a pushed page (Back, no tab bar) built like Frappe's
 * mobile record pages. The balance leads as the hero figure, the other three
 * totals sit in one row under it, then the ledger (Activity / Netted off),
 * the balance chart and the contact details as sections. Export ledger (and
 * Net off, when there is something to net) sit in the action bar at the
 * bottom; everything else is in the header's … menu. All state, requests
 * and handlers come from pages/FriendDetail.jsx.
 */
export default function PersonPhone({
  friend: f,
  first,
  summaryLoaded,
  figures,
  dues,
  needingReview,
  tags,
  rows,
  filtered,
  filter,
  onFilterChange,
  filters,
  view,
  onViewChange,
  offsets,
  activityEmpty,
  ledgerHandlers,
  picking,
  pickedCount,
  onConfirmPicked,
  onStopPicking,
  moreActions,
  netOffReady,
  contactRows,
  onExport,
  onEdit,
  onReview,
  onNetOff,
  onUndoOffset,
}) {
  const { net, iOwe, owedToMe, settlements } = figures;
  const contact = [f.phone, f.email].filter(Boolean).join(' · ');

  const activityPanel = (
    <div role="tabpanel" id="person-panel-activity" aria-labelledby="person-tab-activity" className="person-m-panel">
      {tags.length > 0 && (
        <div className="person-m-filters">
          <TabButtons aria-label="Filter entries" fluid value={filter} onChange={onFilterChange} options={filters} />
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState size="sm" title={activityEmpty.title} description={activityEmpty.description} />
      ) : (
        <PersonLedgerTable rows={rows} {...ledgerHandlers} />
      )}
    </div>
  );

  const nettedPanel = (
    <div role="tabpanel" id="person-panel-netted" aria-labelledby="person-tab-netted" className="person-m-panel">
      {offsets.length === 0 ? (
        <EmptyState
          size="sm"
          title="Nothing netted off"
          description="Net off clears what you owe each other without any money moving."
          action={netOffReady ? <Button size="md" label="Net off" onClick={onNetOff} /> : null}
        />
      ) : (
        <MobileList aria-label="Netted off">
          {offsets.map((o) => {
            const title = `${o.lines.length} ${o.lines.length === 1 ? 'entry' : 'entries'} netted off`;
            return (
              <MobileListItem
                key={o.id}
                title={title}
                subtitle={[formatDayShort(o.createdAt), o.note].filter(Boolean).join(' · ')}
                value={rupees(toMinor(o.amount))}
                actions={[{ label: 'Undo net off', icon: Undo2, onClick: () => onUndoOffset(o) }]}
                actionsLabel={`Actions for ${title}`}
              />
            );
          })}
        </MobileList>
      )}
    </div>
  );

  // Older amount-less settlements: one attention row, straight to the review.
  const legacy = dues.legacyMinor;
  const attention = needingReview > 0
    ? {
        title: `${needingReview} older ${needingReview === 1 ? 'settlement doesn’t' : 'settlements don’t'} match ${
          needingReview === 1 ? 'its' : 'their'
        } entries`,
        subtitle: 'Saved before Fintrack recorded amounts. Review them so the balance is right.',
      }
    : legacy !== 0
      ? { title: 'Older settlements don’t match their entries', subtitle: `${rupees(Math.abs(legacy))} of the balance comes from them` }
      : null;

  return (
    <>
      <PageHeader
        title={f.name}
        back="/friends"
        mobileActions={
          <Dropdown options={moreActions} label={f.name}>
            <Button variant="ghost" size="md" icon={MoreHorizontal} label="More actions" />
          </Dropdown>
        }
      />

      <PageBody className="person-m">
        <header className="person-m-hero">
          <div className="person-m-who">
            <Avatar label={f.name} size="2xl" aria-hidden />
            <div className="person-m-who__text">
              <h2 className="person-m-who__name">{f.name}</h2>
              <p className="person-m-who__contact">{contact || 'No email or phone'}</p>
            </div>
          </div>

          <div className="person-m-balance">
            {summaryLoaded ? (
              <>
                <span className="person-m-balance__label">
                  {net > 0 ? `${first} owes you` : net < 0 ? `You owe ${first}` : `Balance with ${first}`}
                </span>
                <span className="person-m-balance__amount">
                  {net === 0 ? 'All settled' : <Amount value={Math.abs(net)} tone="inherit" />}
                </span>
                {(dues.parts.length > 0 || legacy !== 0) && (
                  <p className="person-m-balance__note">
                    {dues.parts.length > 0 && <>Entry by entry: {dues.parts.join(' · ')}</>}
                    {legacy !== 0 && (
                      <>
                        {dues.parts.length > 0 && ' · '}
                        <span className="person-m-balance__warn">{legacyDuesText(legacy)}</span>
                      </>
                    )}
                  </p>
                )}
              </>
            ) : (
              <>
                <Skeleton width={120} height={14} />
                <Skeleton width={140} height={30} />
              </>
            )}
          </div>

          {/* Nothing shared yet: three zeros would say nothing. */}
          {(tags.length > 0 || !summaryLoaded) && (
            <dl className="person-m-stats">
              <Stat label={`${first} paid for you`} value={iOwe} loading={!summaryLoaded} />
              <Stat label={`You paid for ${first}`} value={owedToMe} loading={!summaryLoaded} />
              <Stat label="Settled" value={settlements} loading={!summaryLoaded} />
            </dl>
          )}
        </header>

        {attention && (
          <MobileList variant="inset" className="person-m-attention" aria-label="Needs attention">
            <MobileListItem
              leading={<ClipboardCheck className="person-m-attention__icon" size={20} strokeWidth={1.5} aria-hidden />}
              title={attention.title}
              subtitle={attention.subtitle}
              onClick={onReview}
              chevron
            />
          </MobileList>
        )}

        <section className="person-m-ledger" aria-label={`${f.name} ledger`}>
          <Tabs
            className="phone-bleed"
            idPrefix="person"
            aria-label={`${f.name} ledger`}
            value={view}
            onChange={onViewChange}
            tabs={[
              { label: 'Activity', value: 'activity', count: tags.length },
              { label: 'Netted off', value: 'netted', count: offsets.length },
            ]}
          />
          {view === 'netted' ? nettedPanel : activityPanel}
        </section>

        <MobileSection title="Balance over time" description={`Above zero, ${first} owes you`}>
          <div className="person-m-chart">
            <BalanceChart tags={tags} friendFirst={first} height={160} />
          </div>
        </MobileSection>

        <MobileSection title="Contact details" action={{ label: 'Edit', onClick: onEdit }}>
          <MobileList variant="inset" aria-label="Contact details">
            {contactRows.map((row) => (
              <MobileField key={row.label} label={row.label}>
                {row.value ? (
                  row.href ? <a className="person-m-link" href={row.href}>{row.value}</a> : row.value
                ) : (
                  <span className="text-ink-gray-4">Not added</span>
                )}
              </MobileField>
            ))}
          </MobileList>
        </MobileSection>
      </PageBody>

      {picking ? (
        <GroupSelectionActionBar
          count={pickedCount}
          target={picking.target}
          onConfirm={onConfirmPicked}
          onCancel={onStopPicking}
        />
      ) : (
        <MobileActionBar>
          {netOffReady && <Button size="lg" iconLeft={ArrowLeftRight} label="Net off" onClick={onNetOff} />}
          <Button size="lg" variant="solid" iconLeft={Download} label="Export ledger" onClick={onExport} />
        </MobileActionBar>
      )}
    </>
  );
}

function Stat({ label, value, loading }) {
  return (
    <div className="person-m-stat">
      <dt className="person-m-stat__label">{label}</dt>
      <dd className="person-m-stat__value">
        {loading ? <Skeleton width={56} height={16} /> : <Amount value={value} tone="inherit" />}
      </dd>
    </div>
  );
}

/** The phone page while the person loads: the hero's shape. */
export function PersonPhoneLoading() {
  return (
    <div className="person-m-hero" aria-busy="true">
      <div className="person-m-who">
        <Skeleton circle width={40} height={40} />
        <div className="person-m-who__text">
          <Skeleton width={140} height={18} />
          <Skeleton width={180} height={13} />
        </div>
      </div>
      <div className="person-m-balance">
        <Skeleton width={120} height={14} />
        <Skeleton width={140} height={30} />
      </div>
      <Skeleton height={160} />
    </div>
  );
}
