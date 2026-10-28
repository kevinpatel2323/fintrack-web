import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, Link2, MoreHorizontal, Unlink, Users,
} from 'lucide-react';
import CcLinkModal from '../components/CcLinkModal.jsx';
import { FriendTagCard } from '../components/FriendTagLedgerDisplay.jsx';
import { sortTableRows } from '../components/TransactionTable.jsx';
import TransactionManageSheet from '../components/TransactionManageSheet.jsx';
import CardBillCard, { COVERED_ORDER } from '../components/transaction-detail/CardBillCard.jsx';
import DetailsPanel from '../components/transaction-detail/DetailsPanel.jsx';
import TransactionDetailPhone, {
  TransactionDetailPhoneStatus,
} from '../components/transaction-detail/TransactionDetailPhone.jsx';
import { formatTxnDate } from '../components/transaction-detail/formatTxnDate.js';
import { CategoryIcon } from '../components/common/Category.jsx';
import {
  Amount, Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, PageBody, PageHeader, Skeleton, toast,
} from '../components/ui';
import { useIsCompact } from '../styles/breakpoints.js';
import { getCcLink, unlinkCcBillPayment } from '../services/cardsApi.js';
import { useCardTransactionManager } from '../hooks/useCardTransactionManager.js';
import { cardTxnStatus, toCardTableRow } from '../utils/cardTransactionRow.jsx';
import { calendarPath } from '../utils/calendarParams.js';
import { transactionsListPath } from '../utils/transactionsListParams.js';
import { API_BASE, apiErrorMessage, apiFetch } from '../services/http.js';
import './TransactionDetail.css';

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsCompact();

  const listPath = transactionsListPath(location.state?.transactionsSearch);
  // The first breadcrumb leads back to where the user came from: the calendar
  // month/day they opened this from, or the filtered list.
  const parentCrumb = location.state?.calendarSearch
    ? { label: 'Calendar', to: calendarPath(location.state.calendarSearch) }
    : { label: 'Transactions', to: listPath };
  // Back to where the user came from, with their filters: the calendar or
  // the list carry their search in navigation state.
  const backFromDetail = () => {
    if (location.state?.calendarSearch) {
      navigate(calendarPath(location.state.calendarSearch));
      return;
    }
    if (location.state?.transactionsSearch) {
      navigate(listPath);
      return;
    }
    // Opened straight from a link: there is no in-app page to go back to.
    if (location.key === 'default') {
      navigate('/transactions');
      return;
    }
    navigate(-1);
  };

  const [tx, setTx] = useState(location.state?.tx || null);
  const [txLoading, setTxLoading] = useState(!location.state?.tx);
  const [txError, setTxError] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [splitApplying, setSplitApplying] = useState(false);
  const [splitSheetOpen, setSplitSheetOpen] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  // { kind: 'removeTag', tagId } | { kind: 'unlink' }
  const [confirm, setConfirm] = useState(null);
  // GET /transactions/:id carries no card-bill info, so the link is a
  // separate fetch.
  const [ccLink, setCcLink] = useState(null);
  const [ccModalOpen, setCcModalOpen] = useState(false);

  // Fetch friends and categories once
  useEffect(() => {
    apiFetch(`${API_BASE}/friends`).then((r) => r.json()).then((d) => setFriends(d.data || [])).catch(() => {});
    apiFetch(`${API_BASE}/categories`).then((r) => r.json()).then((d) => setCategories(d.data || d || [])).catch(() => {});
  }, []);

  // Load transaction from navigation state or API when opened by id only
  useEffect(() => {
    const stateTx = location.state?.tx;
    if (stateTx && String(stateTx.id) === String(id)) {
      setTx(stateTx);
      setTxLoading(false);
      setTxError(false);
      return;
    }

    let cancelled = false;
    setTx(null);
    setTxLoading(true);
    setTxError(false);

    apiFetch(`${API_BASE}/transactions/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load transaction');
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        setTx(body.data ?? body);
        setTxLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTxError(true);
        setTxLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, location.state?.tx]);

  const fetchTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/transactions/${id}/friends`);
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data = await res.json();
      setTags(data.data || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load tags');
    } finally {
      setTagsLoading(false);
    }
  }, [id]);

  // Fetch tags whenever id changes
  useEffect(() => { fetchTags(); }, [fetchTags]);

  // Fetch the credit-card bill link whenever id changes
  useEffect(() => {
    let cancelled = false;
    setCcLink(null);
    getCcLink(id)
      .then((data) => !cancelled && setCcLink(data))
      .catch(() => !cancelled && setCcLink(null));
    return () => { cancelled = true; };
  }, [id]);

  // The covered card transactions are managed like any other ledger row.
  const cardManager = useCardTransactionManager({
    categories,
    onRowPatched: (txnId, patch) =>
      setCcLink((prev) => (prev?.coveredTransactions ? {
        ...prev,
        coveredTransactions: prev.coveredTransactions.map((t) =>
          String(t.id) === String(txnId) ? { ...t, ...patch } : t,
        ),
      } : prev)),
  });

  // Seed split counts from the inline tags the cc-link payload carries.
  useEffect(() => {
    if (ccLink?.coveredTransactions) cardManager.seedTags(ccLink.coveredTransactions, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccLink]);

  // Oldest first, for the phone rows and as the table's starting order.
  const coveredRows = sortTableRows(
    (ccLink?.coveredTransactions || []).map((t) =>
      toCardTableRow(t, cardManager.tagsByTransaction),
    ),
    COVERED_ORDER,
  );

  const cardManageRow = cardManager.manageSheetId
    ? (ccLink?.coveredTransactions || []).find(
        (t) => String(t.id) === String(cardManager.manageSheetId),
      )
    : null;

  function minorToApiAmount(minor) { return Number((minor / 100).toFixed(2)); }

  async function applySplit({ results, direction, note, allocationsByParticipant, groupByParticipant }) {
    setSplitApplying(true);
    const noteTrimmed = typeof note === 'string' ? note.trim() : '';
    try {
      for (const r of results) {
        const lineDirection = r.amountMinor === 0 ? 'NOTHING_OUTSTANDING' : direction;
        const allocations = allocationsByParticipant?.[r.participantId];
        const groupId = groupByParticipant?.[r.participantId];
        const res = await apiFetch(`${API_BASE}/transactions/${id}/friends`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            friendId: Number(r.participantId),
            amount: r.amountMinor === 0 ? 0 : minorToApiAmount(r.amountMinor),
            direction: lineDirection,
            ...(noteTrimmed ? { note: noteTrimmed } : {}),
            ...(lineDirection === 'SETTLEMENT' && allocations?.length > 0 ? { allocations } : {}),
            ...(lineDirection !== 'SETTLEMENT' && groupId ? { entryGroupId: Number(groupId) } : {}),
          }),
        });
        // A rejected tag (an allocation the server refused, say) must not read
        // as "Split applied".
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(apiErrorMessage(data, 'Failed to add tag'));
        }
      }
      await fetchTags();
      // The result shows in place: the "Split with people" card.
      setSplitSheetOpen(false);
      toast.success('Split applied');
    } catch (e) {
      toast.error(e.message || 'Failed to apply split.');
    } finally {
      setSplitApplying(false);
    }
  }

  async function removeTag(tagId) {
    const res = await apiFetch(`${API_BASE}/transactions/${id}/friends/${tagId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    await fetchTags();
    setConfirm(null);
    toast.success('Friend tag removed');
  }

  async function unlinkCc() {
    await unlinkCcBillPayment(id).catch((e) => {
      throw new Error(e.message || 'Failed to unlink');
    });
    setCcLink({ linked: false });
    setConfirm(null);
    toast.success('Card bill unlinked');
  }

  const assignCategory = useCallback(async (categoryId) => {
    setCategorySaving(true);
    try {
      const res = categoryId
        ? await apiFetch(`${API_BASE}/transactions/${id}/category`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: Number(categoryId) }),
        })
        : await apiFetch(`${API_BASE}/transactions/${id}/category`, { method: 'DELETE' });
      // A rejected save must not look saved.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cat = categories.find((c) => String(c.id) === String(categoryId)) || null;
      setTx((prev) => prev ? { ...prev, categoryId: cat?.id || null, category: cat } : prev);
    } catch {
      toast.error('Failed to save category');
    } finally {
      setCategorySaving(false);
    }
  }, [id, categories]);

  // ---------- Loading / not found ----------

  if (txLoading || !tx) {
    if (isMobile) {
      return (
        <TransactionDetailPhoneStatus
          loading={txLoading}
          error={txError}
          onBack={backFromDetail}
          backLabel={parentCrumb.label}
        />
      );
    }
    return (
      <>
        <PageHeader
          title="Transaction"
          breadcrumbs={[parentCrumb, { label: 'Transaction' }]}
          back={backFromDetail}
        />
        <PageBody>
          {txLoading ? (
            <div className="txd-layout" aria-busy="true">
              <div className="txd-layout__summary txd-summary">
                <Skeleton width={40} height={40} />
                <div className="txd-summary__text">
                  <Skeleton height={16} width="50%" />
                  <Skeleton height={13} width="30%" />
                </div>
              </div>
              <div className="txd-layout__side">
                <Card title="Details">
                  <div className="txd-skeleton-rows">
                    {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={14} />)}
                  </div>
                </Card>
              </div>
              <div className="txd-layout__main">
                <Card title="Split with people">
                  <Skeleton height={40} />
                </Card>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={AlertCircle}
              title={txError ? 'Could not load this transaction.' : 'Transaction not found.'}
              action={<Button label={`Back to ${parentCrumb.label}`} onClick={backFromDetail} />}
            />
          )}
        </PageBody>
      </>
    );
  }

  // ---------- Record ----------

  const withdrawal = Number(tx.withdrawal || 0);
  const deposit = Number(tx.deposit || 0);
  const isIncome = deposit > 0;
  const amount = isIncome ? deposit : withdrawal;
  const signed = isIncome ? amount : -amount;
  const verb = isIncome ? 'You received' : 'You paid';
  const splitTotal = withdrawal > 0 ? withdrawal : deposit > 0 ? deposit : 0;
  const title = tx.upiName || tx.narration || 'Transaction';

  const hasTags = tags.length > 0;
  const canSplit = splitTotal > 0 || hasTags;
  const splitLabel = hasTags ? 'Edit split' : 'Split with people';
  // Only a debit can be a card bill payment — the API enforces this too.
  const canLinkCc = Boolean(ccLink && !ccLink.linked && withdrawal > 0 && deposit === 0);
  const linked = Boolean(ccLink?.linked);

  const openSplit = () => setSplitSheetOpen(true);
  const openCcLink = () => setCcModalOpen(true);
  const askUnlink = () => setConfirm({ kind: 'unlink' });
  const askRemoveTag = (tagId) => setConfirm({ kind: 'removeTag', tagId });

  const moreOptions = linked
    ? [{ label: 'Unlink card bill', icon: Unlink, theme: 'red', onClick: askUnlink }]
    : [];

  const headerActions = (
    <>
      {moreOptions.length > 0 && (
        <Dropdown options={moreOptions} placement="bottom-end">
          <Button icon={MoreHorizontal} label="More actions" />
        </Dropdown>
      )}
      {canLinkCc && <Button iconLeft={Link2} label="Link to card bill" onClick={openCcLink} />}
      {canSplit && <Button variant="solid" iconLeft={Users} label={splitLabel} onClick={openSplit} />}
    </>
  );

  // Sheets and dialogs, the same on both layouts.
  const overlays = (
    <>
      <TransactionManageSheet
        open={splitSheetOpen}
        title={title}
        transaction={tx}
        date={tx.transactionDate}
        metaLine={[tx.accountNumber, tx.isManual ? 'Manual' : null].filter(Boolean).join(' · ')}
        amountIn={deposit}
        amountOut={withdrawal}
        showCategory={false}
        notifyResults={false}
        friends={friends}
        tags={tags}
        tagsStatus={tagsLoading ? 'Loading…' : ''}
        splitApplying={splitApplying}
        onApplySplit={applySplit}
        onDeleteTag={askRemoveTag}
        onTagsChanged={fetchTags}
        onClose={() => setSplitSheetOpen(false)}
      />

      {cardManageRow && (
        <TransactionManageSheet
          {...cardManager.manageSheetPropsFor(cardManageRow)}
          metaLine={[
            ccLink?.card ? `${ccLink.card.name} ····${ccLink.card.last4}` : null,
            cardTxnStatus(cardManageRow),
          ].filter(Boolean).join(' · ')}
          friends={friends}
        />
      )}

      {ccModalOpen && (
        <CcLinkModal
          transaction={tx}
          onClose={() => setCcModalOpen(false)}
          onLinked={(result) => { setCcModalOpen(false); setCcLink(result); }}
        />
      )}

      <ConfirmDialog
        open={confirm?.kind === 'removeTag'}
        title="Remove tag?"
        message="This will remove the friend tag from this transaction."
        confirmLabel="Remove"
        onConfirm={() => removeTag(confirm.tagId)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'unlink'}
        title="Unlink card bill?"
        message="The covered card transactions go back to unpaid, and this debit counts as ordinary spend again."
        confirmLabel="Unlink"
        onConfirm={unlinkCc}
        onCancel={() => setConfirm(null)}
      />
    </>
  );

  // Phones get their own layout of the same record: one column, the main
  // action pinned at the bottom, the rest in the header's menu.
  if (isMobile) {
    return (
      <>
        <TransactionDetailPhone
          tx={tx}
          title={title}
          onBack={backFromDetail}
          categories={categories}
          onAssignCategory={assignCategory}
          categorySaving={categorySaving}
          tags={tags}
          tagsLoading={tagsLoading}
          ccLink={ccLink}
          coveredRows={coveredRows}
          cardManager={cardManager}
          canSplit={canSplit}
          splitLabel={splitLabel}
          splitTotal={splitTotal}
          canLinkCc={canLinkCc}
          onSplit={openSplit}
          onLinkCc={openCcLink}
          onUnlinkCc={askUnlink}
          onRemoveTag={askRemoveTag}
          onTagsChanged={fetchTags}
        />
        {overlays}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Transaction"
        breadcrumbs={[parentCrumb, { label: title }]}
        back={backFromDetail}
        actions={headerActions}
      />

      <PageBody className="txd-page">
        <div className="txd-layout">
          <section className="txd-layout__summary txd-summary" aria-label="Summary">
            <CategoryIcon category={tx.category} size={40} />
            <div className="txd-summary__text">
              <h2 className="txd-summary__title">{title}</h2>
              <p className="txd-summary__meta">
                {verb} · {formatTxnDate(tx.transactionDate)}
              </p>
              {(hasTags || linked || tx.isManual) && (
                <div className="txd-summary__badges">
                  {hasTags && (
                    <Badge
                      prefix={Users}
                      label={`Split with ${tags.length} ${tags.length === 1 ? 'person' : 'people'}`}
                    />
                  )}
                  {linked && <Badge theme="blue" prefix={Link2} label="Card bill payment" />}
                  {tx.isManual && <Badge label="Manual" />}
                </div>
              )}
            </div>
            <Amount className="txd-summary__amount" value={signed} sign="always" />
          </section>

          <div className="txd-layout__side">
            <DetailsPanel
              tx={tx}
              title={title}
              categories={categories}
              onAssignCategory={assignCategory}
              categorySaving={categorySaving}
            />
          </div>

          <div className="txd-layout__main">
            <Card
              as="section"
              title="Split with people"
              description={hasTags ? `${tags.length} ${tags.length === 1 ? 'friend tag' : 'friend tags'}` : undefined}
            >
              {tagsLoading && !hasTags ? (
                <div aria-busy="true" className="txd-skeleton-rows">
                  <Skeleton height={40} />
                </div>
              ) : hasTags ? (
                <div className="txd-tags">
                  {tags.map((tag) => (
                    <FriendTagCard
                      key={tag.id}
                      tag={tag}
                      transaction={tx}
                      friendName={tag.friend?.name || `Friend #${tag.friendId}`}
                      onRemove={() => askRemoveTag(tag.id)}
                      onAllocationChanged={fetchTags}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  size="sm"
                  icon={Users}
                  title="No friend tags yet"
                  description="Split it to track who owes whom."
                  action={splitTotal > 0
                    ? <Button iconLeft={Users} label="Split with people" onClick={openSplit} />
                    : null}
                />
              )}
            </Card>

            {linked && (
              <CardBillCard
                ccLink={ccLink}
                rows={coveredRows}
                isMobile={false}
                categories={categories}
                onAssignCategory={cardManager.assignCategory}
                onOpenManage={cardManager.openManage}
              />
            )}
          </div>
        </div>
      </PageBody>

      {overlays}
    </>
  );
}
