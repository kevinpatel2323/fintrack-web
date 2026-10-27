import { useEffect, useId, useMemo, useRef, useState } from 'react';
import SplitTransactionForm from './SplitTransactionForm.jsx';
import { FriendTagCard } from './FriendTagLedgerDisplay.jsx';
import { Amount, Button, FormControl, LoadingIndicator, Sheet } from './ui';
import { categoryOptions } from './common/Category.jsx';
import { formatTxnDate } from './transaction-detail/formatTxnDate.js';
import { isProgressStatus, useStatusToasts } from './transaction-detail/useStatusToasts.js';
import './transaction-detail/TransactionManageSheet.css';

const formatDate = (value) => (value ? formatTxnDate(value) : '');

/**
 * The "manage transaction" sheet: category, splits and friend tags for one
 * transaction. Shared by the bank ledger and a card's ledger — a card
 * transaction is managed exactly like a bank one, the only difference being
 * the ledger-specific buttons passed in via `actions`.
 *
 * `amountIn` / `amountOut` describe the transaction in ledger terms: a card
 * refund is money in, an ordinary card spend is money out.
 *
 * Callers mount it while it is open (`{row && <TransactionManageSheet … />}`).
 * Optional: `open` (default true), `title` (defaults to the merchant or
 * description), `showCategory` (default true) and `notifyResults` (default
 * true: results of the caller's status strings become toasts; pass false when
 * the caller toasts itself).
 */
export default function TransactionManageSheet({
  transaction,
  date,
  metaLine,
  amountIn = 0,
  amountOut = 0,
  categories = [],
  categoryId,
  onAssignCategory,
  categoryStatus,
  actions,
  friends = [],
  tags = [],
  tagsStatus,
  splitApplying = false,
  onApplySplit,
  onDeleteTag,
  onTagsChanged,
  onClose,
  open = true,
  title,
  showCategory = true,
  notifyResults = true,
}) {
  const inAmount = Number(amountIn || 0);
  const outAmount = Number(amountOut || 0);
  const splitTotal = outAmount > 0 ? outAmount : inAmount > 0 ? inAmount : 0;

  const formRef = useRef(null);
  const uid = useId();
  const [formState, setFormState] = useState({ canApply: false });
  // The form unmounts with the sheet; don't let its last state outlive it.
  useEffect(() => {
    if (!open) setFormState({ canApply: false });
  }, [open]);

  useStatusToasts({ tagsStatus, categoryStatus, splitApplying, enabled: notifyResults });

  const options = useMemo(() => categoryOptions(categories), [categories]);
  const participants = useMemo(
    () => friends.map((f) => ({ id: String(f.id), name: f.name })),
    [friends],
  );
  const taggedFriendIds = useMemo(() => tags.map((t) => String(t.friendId)), [tags]);

  const heading =
    title || transaction?.merchant || transaction?.upiName || transaction?.narration || formatDate(date) || 'Transaction';
  const description = [formatDate(date), metaLine].filter(Boolean).join(' · ');
  const tagsBusy = isProgressStatus(tagsStatus) ? tagsStatus : '';
  const categoryBusy = isProgressStatus(categoryStatus);

  const net = inAmount - outAmount;
  const netDecimals = Math.round(Math.abs(net) * 100) % 100 !== 0 ? 2 : 0;

  const footer = splitTotal > 0 ? (
    <>
      <Button label="Cancel" onClick={onClose} />
      <Button
        variant="solid"
        label="Add split"
        loading={splitApplying}
        loadingText="Adding…"
        disabled={!formState.canApply}
        onClick={() => formRef.current?.apply()}
      />
    </>
  ) : (
    <Button label="Close" onClick={onClose} />
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={heading}
      description={description || undefined}
      width={520}
      footer={footer}
    >
      <div className="txm">
        <div className="txm-summary">
          <Amount className="txm-summary__amount" value={net} sign="always" decimals={netDecimals} />
          <span className="txm-summary__meta">
            {outAmount > 0 ? 'Out' : 'In'}
            {' · '}
            {tags.length} {tags.length === 1 ? 'friend tag' : 'friend tags'}
          </span>
        </div>

        {(showCategory || actions) && (
          <section className="txm-section">
            {showCategory && (
              <FormControl
                type="combobox"
                label="Category"
                options={options}
                value={categoryId != null && categoryId !== '' ? String(categoryId) : null}
                onChange={(value) => onAssignCategory?.(value ?? '')}
                placeholder="No category"
                searchPlaceholder="Search categories"
                clearable
                description={categoryBusy ? categoryStatus : undefined}
              />
            )}
            {actions ? <div className="txm-actions">{actions}</div> : null}
          </section>
        )}

        <section className="txm-section" aria-labelledby={`${uid}-tags`}>
          <div className="txm-section__head">
            <h3 id={`${uid}-tags`} className="txm-heading">Split with</h3>
            {tagsBusy && <LoadingIndicator text={tagsBusy} />}
          </div>
          {tags.length === 0 ? (
            !tagsBusy && <p className="txm-muted">No friend attached.</p>
          ) : (
            <div className="txm-tags">
              {tags.map((tag) => (
                <FriendTagCard
                  key={tag.id}
                  tag={tag}
                  transaction={transaction}
                  friendName={tag.friend?.name || String(tag.friendId)}
                  onRemove={onDeleteTag ? () => onDeleteTag(tag.id) : undefined}
                  onAllocationChanged={onTagsChanged}
                />
              ))}
            </div>
          )}
        </section>

        {splitTotal > 0 ? (
          <section className="txm-section" aria-labelledby={`${uid}-split`}>
            <h3 id={`${uid}-split`} className="txm-heading">Split transaction</h3>
            <SplitTransactionForm
              key={`split-${transaction?.id}`}
              ref={formRef}
              hideApplyButton
              onStateChange={setFormState}
              totalAmount={splitTotal}
              participants={participants}
              taggedFriendIds={taggedFriendIds}
              defaultDirection="OWES_ME"
              applying={splitApplying}
              onApplySplit={onApplySplit}
            />
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}
