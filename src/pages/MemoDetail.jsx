import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, MoreHorizontal, RefreshCw, RotateCw, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, PageBody, PageHeader, Skeleton, toast,
} from '../components/ui';
import { useAccountNames } from '../hooks/useAccounts.js';
import { refreshMemoSummary } from '../hooks/useMemoSummary.js';
import { deleteMemo, fetchMemo, reparseMemo, updateMemo } from '../services/memosApi.js';
import { useIsCompact } from '../styles/breakpoints.js';
import MemoDetailPhone, { MemoDetailPhoneStatus } from './memos/MemoDetailPhone.jsx';
import {
  MemoDetailsPanel, MemoEditor, MemoMessage,
} from './memos/memoDetailParts.jsx';
import { MemoAmount, MemoTile, UnverifiedBadge } from './memos/memoParts.jsx';
import {
  memoPayee, memoSummaryLine, memosListPath, normaliseMemo, parseStatusOf,
} from './memos/memoModel.js';
import './Memos.css';

/**
 * One memo (/memos/:id), laid out like the transaction page: the payee,
 * amount and what happened on top; the memo to write and the SMS as it
 * arrived on the left; what was read from it in a side panel on the right
 * (one column below 1024px). Re-parse in the header, Delete in its `…`.
 *
 * The list hands its copy of the memo over in navigation state, so the page
 * shows at once; the message, location and parse error load here.
 */
export default function MemoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsCompact();
  const accountNames = useAccountNames();

  const listPath = memosListPath(location.state?.memosSearch);
  const stateMemo = location.state?.memo && String(location.state.memo.id) === String(id) ? location.state.memo : null;

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loadKey, setLoadKey] = useState(0);
  const [draft, setDraft] = useState(stateMemo?.memo ?? '');
  const [saving, setSaving] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setDetail(null);
    setError('');
    fetchMemo(id, { signal: ctrl.signal })
      .then((data) => setDetail(data))
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message || 'Could not load this memo');
      });
    return () => ctrl.abort();
  }, [id, loadKey]);

  const memo = detail || stateMemo;
  const savedMemo = memo?.memo ?? '';
  // The box starts from the saved memo, and follows it after a save or load.
  useEffect(() => {
    setDraft(savedMemo);
  }, [id, savedMemo]);

  const dirty = normaliseMemo(draft) !== normaliseMemo(savedMemo);
  const retry = useCallback(() => setLoadKey((k) => k + 1), []);

  async function save() {
    if (!memo || !dirty) return;
    const text = normaliseMemo(draft);
    setSaving(true);
    try {
      const updated = await updateMemo(memo.id, text);
      setDetail((d) => ({ ...(d || memo), ...updated }));
      toast.success(text ? 'Memo saved' : 'Memo cleared');
      refreshMemoSummary();
    } catch (e) {
      toast.error({ title: 'Could not save the memo', description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function reparse() {
    setReparsing(true);
    try {
      const next = await reparseMemo(id);
      setDetail(next);
      setError('');
      toast.success({ title: 'Memo re-parsed', description: parseStatusOf(next?.parseStatus).label });
    } catch (e) {
      toast.error({ title: 'Could not re-parse the memo', description: e.message });
    } finally {
      setReparsing(false);
    }
  }

  async function remove() {
    try {
      await deleteMemo(id);
    } catch (e) {
      toast.error({ title: 'Could not delete the memo', description: e.message });
      setConfirmDelete(false);
      return;
    }
    setConfirmDelete(false);
    toast.success('Memo deleted');
    refreshMemoSummary();
    navigate(listPath, { replace: true });
  }

  const deleteDialog = (
    <ConfirmDialog
      open={confirmDelete}
      title="Delete this memo?"
      message="The bank SMS, what was read from it and its memo are removed from Fintrack. This can't be undone."
      confirmLabel="Delete"
      onConfirm={remove}
      onCancel={() => setConfirmDelete(false)}
    />
  );

  // ---------- Loading / couldn't load ----------
  if (!memo) {
    if (isMobile) {
      return <MemoDetailPhoneStatus loading={!error} error={error} onRetry={retry} />;
    }
    return (
      <>
        <PageHeader title="Memo" breadcrumbs={[{ label: 'Memos', to: listPath }, { label: 'Memo' }]} back="/memos" />
        <PageBody>
          {!error ? (
            <div className="memos-detail" aria-busy="true">
              <div className="memos-detail__summary memos-summary">
                <Skeleton width={40} height={40} />
                <div className="memos-summary__text">
                  <Skeleton height={16} width="50%" />
                  <Skeleton height={13} width="30%" />
                </div>
              </div>
              <div className="memos-detail__side">
                <Card title="Details">
                  <div className="memos-skeleton-rows">
                    {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={14} />)}
                  </div>
                </Card>
              </div>
              <div className="memos-detail__main">
                <Card title="Memo">
                  <Skeleton height={72} />
                </Card>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={AlertCircle}
              title="Could not load this memo"
              description={error}
              action={(
                <div className="memos-actions-row">
                  <Button label="Back to Memos" to={listPath} />
                  <Button iconLeft={RefreshCw} label="Try again" onClick={retry} />
                </div>
              )}
            />
          )}
        </PageBody>
      </>
    );
  }

  // ---------- Record ----------
  const payee = memoPayee(memo);
  const status = parseStatusOf(memo.parseStatus);
  const showStatus = memo.parseStatus !== 'parsed';
  const editor = (
    <MemoEditor
      value={draft}
      onChange={setDraft}
      onSave={save}
      memoAt={memo.memoAt}
      saving={saving}
      dirty={dirty}
      phone={isMobile}
    />
  );
  const message = <MemoMessage detail={detail} error={detail ? '' : error} onRetry={retry} phone={isMobile} />;

  if (isMobile) {
    return (
      <>
        <MemoDetailPhone
          memo={memo}
          detail={detail}
          detailError={error}
          payee={payee}
          accountNames={accountNames}
          summaryLine={memoSummaryLine(memo, accountNames)}
          status={showStatus ? status : null}
          editor={editor}
          message={message}
          dirty={dirty}
          saving={saving}
          onSave={save}
          reparsing={reparsing}
          onReparse={reparse}
          onDelete={() => setConfirmDelete(true)}
        />
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Memo"
        breadcrumbs={[{ label: 'Memos', to: listPath }, { label: payee }]}
        back="/memos"
        actions={(
          <>
            <Button iconLeft={RotateCw} label="Re-parse" loading={reparsing} onClick={reparse} />
            <Dropdown
              placement="bottom-end"
              label="Memo actions"
              options={[{ label: 'Delete', icon: Trash2, theme: 'red', onClick: () => setConfirmDelete(true) }]}
            >
              <Button icon={MoreHorizontal} label="More actions" />
            </Dropdown>
          </>
        )}
      />

      <PageBody className="memos-detail-page">
        <div className="memos-detail">
          <section className="memos-detail__summary memos-summary" aria-label="Summary">
            <MemoTile memo={memo} size={40} />
            <div className="memos-summary__text">
              <h2 className="memos-summary__title">{payee}</h2>
              <p className="memos-summary__meta">{memoSummaryLine(memo, accountNames)}</p>
              {(memo.senderVerified === false || showStatus) && (
                <div className="memos-summary__badges">
                  {memo.senderVerified === false && <UnverifiedBadge size="md" />}
                  {showStatus && <Badge theme={status.theme} label={status.label} />}
                </div>
              )}
            </div>
            <MemoAmount className="memos-summary__amount" memo={memo} />
          </section>

          <div className="memos-detail__side">
            <MemoDetailsPanel memo={memo} detail={detail} detailError={error} accountNames={accountNames} />
          </div>

          <div className="memos-detail__main">
            <Card as="section" title="Memo">{editor}</Card>
            <Card as="section" title="Message">{message}</Card>
          </div>
        </div>
      </PageBody>

      {deleteDialog}
    </>
  );
}
