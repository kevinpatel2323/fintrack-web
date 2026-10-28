import { useEffect, useId, useMemo, useRef, useState } from 'react';
import SplitTransactionForm from './SplitTransactionForm.jsx';
import { FriendTagCard } from './FriendTagLedgerDisplay.jsx';
import {
  Amount, Button, FormControl, LoadingIndicator, MobileList, MobileSection, Sheet,
} from './ui';
import { categoryOptions } from './common/Category.jsx';
import { CategoryRow } from './transaction-detail/CategoryRow.jsx';
import { formatTxnDate } from './transaction-detail/formatTxnDate.js';
import { isProgressStatus, useStatusToasts } from './transaction-detail/useStatusToasts.js';
import { useIsCompact } from '../styles/breakpoints.js';
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
  const isMobile = useIsCompact();
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

  if (isMobile) {
    return (
      <PhoneManageSheet
        open={open}
        onClose={onClose}
        heading={heading}
        description={description}
        net={net}
        netDecimals={netDecimals}
        outAmount={outAmount}
        splitTotal={splitTotal}
        showCategory={showCategory}
        categories={categories}
        categoryId={categoryId}
        categoryBusy={categoryBusy}
        onAssignCategory={onAssignCategory}
        actions={actions}
        tags={tags}
        tagsBusy={tagsBusy}
        transaction={transaction}
        onDeleteTag={onDeleteTag}
        onTagsChanged={onTagsChanged}
        formRef={formRef}
        formState={formState}
        setFormState={setFormState}
        participants={participants}
        taggedFriendIds={taggedFriendIds}
        splitApplying={splitApplying}
        onApplySplit={onApplySplit}
      />
    );
  }

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

/**
 * The same sheet on a phone (a bottom sheet): the amount as the figure under
 * the title, Category as a row that opens the picker sheet, who it's split
 * with as list rows, then the split form. Cancel and Add split share the
 * pinned footer at full size. Same props and handlers as the desktop panel.
 */
function PhoneManageSheet({
  open,
  onClose,
  heading,
  description,
  net,
  netDecimals,
  outAmount,
  splitTotal,
  showCategory,
  categories,
  categoryId,
  categoryBusy,
  onAssignCategory,
  actions,
  tags,
  tagsBusy,
  transaction,
  onDeleteTag,
  onTagsChanged,
  formRef,
  formState,
  setFormState,
  participants,
  taggedFriendIds,
  splitApplying,
  onApplySplit,
}) {
  const splitLine = tags.length > 0
    ? `Split with ${tags.length} ${tags.length === 1 ? 'person' : 'people'}`
    : 'Not split yet';

  const footer = splitTotal > 0 ? (
    <>
      <Button size="lg" label="Cancel" onClick={onClose} />
      <Button
        size="lg"
        variant="solid"
        label="Add split"
        loading={splitApplying}
        loadingText="Adding…"
        disabled={!formState.canApply}
        onClick={() => formRef.current?.apply()}
      />
    </>
  ) : (
    <Button size="lg" label="Close" onClick={onClose} />
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={heading}
      description={description || undefined}
      footer={footer}
      className="txm-sheet"
    >
      <div className="txm-m">
        <div className="txm-m-hero">
          <Amount className="txm-m-hero__amount" value={net} sign="always" decimals={netDecimals} />
          <span className="txm-m-hero__meta">
            {outAmount > 0 ? 'Money out' : 'Money in'} · {splitLine}
          </span>
        </div>

        {(showCategory || actions) && (
          <div className="txm-m-group">
            {showCategory && (
              <MobileList variant="inset" aria-label="Category">
                <CategoryRow
                  categories={categories}
                  value={categoryId}
                  onChange={(value) => onAssignCategory?.(value)}
                  saving={categoryBusy}
                />
              </MobileList>
            )}
            {actions ? <div className="txm-m-actions">{actions}</div> : null}
          </div>
        )}

        <MobileSection title="Split with">
          {tagsBusy ? <LoadingIndicator text={tagsBusy} /> : null}
          {tags.length === 0 ? (
            !tagsBusy && <p className="txm-m-muted">Not split with anyone yet.</p>
          ) : (
            <div className="txm-m-tags" role="list" aria-label="People on this transaction">
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
        </MobileSection>

        {splitTotal > 0 ? (
          <MobileSection title="Split transaction">
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
          </MobileSection>
        ) : null}
      </div>
    </Sheet>
  );
}
